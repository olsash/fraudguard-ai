using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using FraudGuard.Api.DTOs;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;

namespace FraudGuard.Api.Services;

public sealed class OnnxFraudPredictionService : IFraudPredictionService, IDisposable
{
    private const decimal MaximumReasonableMoneyValue = 1_000_000_000_000m;
    private const string FraudClassLabel = "1";
    private readonly InferenceSession _session;
    private readonly OnnxModelMetadata _metadata;
    private readonly string _modelPath;
    private readonly ILogger<OnnxFraudPredictionService> _logger;

    public OnnxFraudPredictionService(IWebHostEnvironment environment, ILogger<OnnxFraudPredictionService> logger)
    {
        _logger = logger;
        var modelDirectory = Path.Combine(environment.ContentRootPath, "MLModels");
        _modelPath = Path.Combine(modelDirectory, "fraud_model.onnx");
        var metadataPath = Path.Combine(modelDirectory, "fraud_model.metadata.json");

        if (!File.Exists(_modelPath))
        {
            throw new InvalidOperationException($"ONNX fraud model artifact is missing. Expected model at '{_modelPath}'. Run 'python ml\\export_model_to_onnx.py' from the repository root.");
        }

        if (!File.Exists(metadataPath))
        {
            throw new InvalidOperationException($"ONNX fraud model metadata is missing. Expected metadata at '{metadataPath}'. Run 'python ml\\export_model_to_onnx.py' from the repository root.");
        }

        _metadata = LoadMetadata(metadataPath);
        _session = new InferenceSession(_modelPath);
        ValidateSession();
        _logger.LogInformation("Loaded ONNX fraud model from {ModelPath}. Input={InputTensorName}, probabilityOutput={ProbabilityOutputName}", _modelPath, _metadata.InputTensorName, _metadata.ProbabilityOutputName);
    }

    public Task<FraudPredictionResult> PredictAsync(CreatePredictionRequest request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        ValidateRequest(request);

        var inputs = BuildInputValues(request);
        using var outputs = _session.Run(inputs);
        var fraudProbability = ExtractFraudProbability(outputs);
        var riskScore = ClampScore(fraudProbability * 100);
        var isFraud = fraudProbability >= _metadata.ClassificationThreshold;
        var predictedClass = isFraud ? "Fraud" : riskScore >= 40 ? "Review" : "Not fraud";
        var reasons = BuildReasons(request, fraudProbability, riskScore, isFraud);

        return Task.FromResult(new FraudPredictionResult
        {
            FraudProbability = Math.Round(fraudProbability, 4),
            RiskScore = riskScore,
            RiskLevel = RiskLevel(riskScore),
            IsFraud = isFraud,
            PredictedClass = predictedClass,
            Confidence = Math.Round(Math.Max(fraudProbability, 1 - fraudProbability), 4),
            ModelName = _metadata.ModelName,
            ModelTrainingDate = _metadata.ModelTrainingDate,
            ModelVersion = _metadata.ModelVersion,
            Reasons = reasons,
            ExplanationFactors = reasons,
            RiskBreakdown = BuildRiskBreakdown(request),
            SuggestedAction = SuggestedAction(riskScore)
        });
    }

    public void Dispose()
    {
        _session.Dispose();
    }

    private static OnnxModelMetadata LoadMetadata(string metadataPath)
    {
        try
        {
            var json = File.ReadAllText(metadataPath);
            var metadata = JsonSerializer.Deserialize<OnnxModelMetadata>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            return metadata ?? throw new InvalidOperationException($"ONNX metadata file '{metadataPath}' is empty or invalid.");
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException($"ONNX metadata file '{metadataPath}' is not valid JSON.", ex);
        }
    }

    private void ValidateSession()
    {
        var inputTensors = _metadata.InputTensors.Count > 0
            ? _metadata.InputTensors
            : [new OnnxInputTensorMetadata { Name = _metadata.InputTensorName, Feature = _metadata.InputTensorName, Type = "tensor(float)" }];

        foreach (var expectedInput in inputTensors)
        {
            if (string.IsNullOrWhiteSpace(expectedInput.Name))
            {
                throw new InvalidOperationException("ONNX metadata inputTensors contains an input with an empty name.");
            }

            if (!_session.InputMetadata.TryGetValue(expectedInput.Name, out var actualInput))
            {
                throw new InvalidOperationException($"ONNX model '{_modelPath}' does not contain expected input tensor '{expectedInput.Name}'. Available inputs: {string.Join(", ", _session.InputMetadata.Keys)}.");
            }

            if (!IsCompatibleTensorType(expectedInput.Type, actualInput.ElementType))
            {
                throw new InvalidOperationException($"ONNX input tensor '{expectedInput.Name}' has type '{actualInput.ElementType}', but metadata expected '{expectedInput.Type}'.");
            }
        }

        if (!_session.OutputMetadata.ContainsKey(_metadata.ProbabilityOutputName))
        {
            throw new InvalidOperationException($"ONNX model '{_modelPath}' does not contain expected probability output '{_metadata.ProbabilityOutputName}'. Available outputs: {string.Join(", ", _session.OutputMetadata.Keys)}.");
        }

        if (_metadata.Classes.Count == 0 || !_metadata.Classes.Contains(_metadata.FraudClass))
        {
            throw new InvalidOperationException($"ONNX metadata classes must include fraud class '{_metadata.FraudClass}'.");
        }

        var fraudIndex = _metadata.Classes.IndexOf(_metadata.FraudClass);
        if (fraudIndex != _metadata.ProbabilityClassIndex)
        {
            throw new InvalidOperationException($"ONNX metadata probabilityClassIndex ({_metadata.ProbabilityClassIndex}) does not match fraud class '{_metadata.FraudClass}' position ({fraudIndex}) in classes.");
        }

        if (_metadata.Preprocessing.ScaleNumericFeatures && _metadata.Preprocessing.NumericScaler is null)
        {
            throw new InvalidOperationException("ONNX metadata says numeric scaling is required, but preprocessing.numericScaler is missing.");
        }
    }

    private List<NamedOnnxValue> BuildInputValues(CreatePredictionRequest request)
    {
        if (_metadata.InputTensors.Count == 0)
        {
            return BuildEncodedInputValues(request);
        }

        var normalizedType = NormalizeTransactionType(request.TransactionType);
        var inputs = new List<NamedOnnxValue>(_metadata.InputTensors.Count);

        foreach (var input in _metadata.InputTensors)
        {
            if (string.Equals(input.Feature, "type", StringComparison.OrdinalIgnoreCase))
            {
                var tensor = new DenseTensor<string>([1, 1]);
                tensor[0, 0] = normalizedType;
                inputs.Add(NamedOnnxValue.CreateFromTensor(input.Name, tensor));
                continue;
            }

            var numericTensor = new DenseTensor<float>([1, 1]);
            numericTensor[0, 0] = (float)RawFeatureValue(request, input.Feature);
            inputs.Add(NamedOnnxValue.CreateFromTensor(input.Name, numericTensor));
        }

        return inputs;
    }

    private List<NamedOnnxValue> BuildEncodedInputValues(CreatePredictionRequest request)
    {
        var tensor = new DenseTensor<float>([1, _metadata.ColumnOrder.Count]);
        var normalizedType = NormalizeTransactionType(request.TransactionType);

        for (var index = 0; index < _metadata.ColumnOrder.Count; index++)
        {
            var column = _metadata.ColumnOrder[index];
            var value = EncodedColumnValue(request, normalizedType, column);
            tensor[0, index] = (float)value;
        }

        return [NamedOnnxValue.CreateFromTensor(_metadata.InputTensorName, tensor)];
    }

    private double EncodedColumnValue(CreatePredictionRequest request, string normalizedType, string column)
    {
        var value = column switch
        {
            "amount" or "oldbalanceOrg" or "newbalanceOrig" or "oldbalanceDest" or "newbalanceDest" => RawFeatureValue(request, column),
            _ when column.StartsWith("type_", StringComparison.Ordinal) => string.Equals(column["type_".Length..], normalizedType, StringComparison.OrdinalIgnoreCase) ? 1.0 : 0.0,
            _ => throw new FraudPredictionException($"ONNX metadata contains unsupported input feature column '{column}'.")
        };

        return ApplyScalingIfNeeded(column, value);
    }

    private static double RawFeatureValue(CreatePredictionRequest request, string feature)
    {
        return feature switch
        {
            "amount" => (double)request.AmountValue,
            "oldbalanceOrg" => (double)request.OldBalanceOriginValue,
            "newbalanceOrig" => (double)request.NewBalanceOriginValue,
            "oldbalanceDest" => (double)request.OldBalanceDestinationValue,
            "newbalanceDest" => (double)request.NewBalanceDestinationValue,
            _ => throw new FraudPredictionException($"ONNX metadata contains unsupported raw input feature '{feature}'.")
        };
    }

    private double ApplyScalingIfNeeded(string column, double value)
    {
        var scaler = _metadata.Preprocessing.NumericScaler;
        if (!_metadata.Preprocessing.ScaleNumericFeatures || scaler is null)
        {
            return value;
        }

        var index = scaler.Features.FindIndex(feature => string.Equals(feature, column, StringComparison.Ordinal));
        if (index < 0)
        {
            return value;
        }

        var scale = scaler.Scale[index];
        if (scale == 0)
        {
            throw new FraudPredictionException($"ONNX metadata scaler has zero scale for feature '{column}'.");
        }

        return (value - scaler.Mean[index]) / scale;
    }

    private double ExtractFraudProbability(IDisposableReadOnlyCollection<DisposableNamedOnnxValue> outputs)
    {
        var output = outputs.FirstOrDefault(item => item.Name == _metadata.ProbabilityOutputName)
            ?? throw new FraudPredictionException($"ONNX output '{_metadata.ProbabilityOutputName}' was not returned by the model.");

        var probabilities = output.Value switch
        {
            DenseTensor<float> tensor => tensor.ToArray().Select(value => (double)value).ToArray(),
            IEnumerable<float> values => values.Select(value => (double)value).ToArray(),
            DenseTensor<double> tensor => tensor.ToArray(),
            IEnumerable<double> values => values.ToArray(),
            _ => throw new FraudPredictionException($"ONNX probability output '{_metadata.ProbabilityOutputName}' has unsupported type '{output.Value.GetType().FullName}'.")
        };

        if (_metadata.ProbabilityClassIndex < 0 || _metadata.ProbabilityClassIndex >= probabilities.Length)
        {
            throw new FraudPredictionException($"ONNX probability output has {probabilities.Length} values, but metadata fraud probability index is {_metadata.ProbabilityClassIndex}.");
        }

        return Math.Clamp(probabilities[_metadata.ProbabilityClassIndex], 0, 1);
    }

    private static void ValidateRequest(CreatePredictionRequest request)
    {
        var invalidFields = new List<string>();
        AddInvalidField(invalidFields, request.AmountValue, "amount");
        AddInvalidField(invalidFields, request.OldBalanceOriginValue, "oldBalanceOrigin");
        AddInvalidField(invalidFields, request.NewBalanceOriginValue, "newBalanceOrigin");
        AddInvalidField(invalidFields, request.OldBalanceDestinationValue, "oldBalanceDestination");
        AddInvalidField(invalidFields, request.NewBalanceDestinationValue, "newBalanceDestination");

        if (invalidFields.Count > 0)
        {
            throw new FraudPredictionInputException($"Prediction inputs must be numeric, non-negative, and no greater than {MaximumReasonableMoneyValue.ToString(CultureInfo.InvariantCulture)}: {string.Join(", ", invalidFields)}.");
        }
    }

    private static void AddInvalidField(List<string> invalidFields, decimal value, string fieldName)
    {
        if (value < 0 || value > MaximumReasonableMoneyValue)
        {
            invalidFields.Add(fieldName);
        }
    }

    private static string[] BuildReasons(CreatePredictionRequest request, double fraudProbability, int riskScore, bool isFraud)
    {
        var reasons = new List<string>
        {
            $"Input Values|Transaction amount is {FormatAmount(request.AmountValue)}.",
            $"Input Values|Transaction type is {NormalizeTransactionType(request.TransactionType)}.",
            $"Model Signals|ONNX model fraud probability is {fraudProbability:P2}.",
            $"Model Signals|Model threshold for fraud is 0.50; final risk score is {riskScore}/100.",
            isFraud
                ? "Final Decision|Fraud probability meets or exceeds the exported model threshold, so the transaction is flagged as fraud."
                : "Final Decision|Fraud probability is below the exported model threshold, so the transaction is not flagged as fraud."
        };

        var originDelta = request.OldBalanceOriginValue - request.NewBalanceOriginValue;
        var destinationDelta = request.NewBalanceDestinationValue - request.OldBalanceDestinationValue;
        reasons.Add($"Balance Movement|Origin balance changed from {FormatAmount(request.OldBalanceOriginValue)} to {FormatAmount(request.NewBalanceOriginValue)} (decrease of {FormatAmount(originDelta)}).");
        reasons.Add($"Balance Movement|Destination balance changed from {FormatAmount(request.OldBalanceDestinationValue)} to {FormatAmount(request.NewBalanceDestinationValue)} (increase of {FormatAmount(destinationDelta)}).");

        return reasons.ToArray();
    }

    private static RiskBreakdownFactor[] BuildRiskBreakdown(CreatePredictionRequest request)
    {
        var normalizedType = NormalizeTransactionType(request.TransactionType);
        var sensitiveType = normalizedType is "TRANSFER" or "CASH_OUT";
        var originDelta = request.OldBalanceOriginValue - request.NewBalanceOriginValue;
        var destinationDelta = request.NewBalanceDestinationValue - request.OldBalanceDestinationValue;

        return
        [
            new()
            {
                Factor = request.AmountValue >= 100_000 ? "High transaction amount" : "Transaction amount",
                Impact = request.AmountValue >= 100_000 ? "Risk" : "Neutral",
                Explanation = request.AmountValue >= 100_000
                    ? $"Amount is {FormatAmount(request.AmountValue)}, above the high-value threshold."
                    : $"Amount is {FormatAmount(request.AmountValue)}, below the high-value threshold."
            },
            new()
            {
                Factor = "Transfer or cash-out transaction type",
                Impact = sensitiveType ? "Risk" : "Protective",
                Explanation = sensitiveType
                    ? $"{normalizedType} is fraud-sensitive because money leaves or moves between accounts."
                    : $"{normalizedType} is not one of the higher-risk transfer or cash-out types."
            },
            new()
            {
                Factor = "Origin account balance drop",
                Impact = originDelta <= 0 && request.AmountValue > 0 ? "Risk" : "Protective",
                Explanation = $"Origin balance changed by {FormatAmount(originDelta)}."
            },
            new()
            {
                Factor = "Destination account balance behavior",
                Impact = destinationDelta < 0 ? "Risk" : "Protective",
                Explanation = $"Destination balance changed by {FormatAmount(destinationDelta)}."
            },
            new()
            {
                Factor = "Zero balance after transaction",
                Impact = request.NewBalanceOriginValue == 0 || request.NewBalanceDestinationValue == 0 ? "Risk" : "Protective",
                Explanation = request.NewBalanceOriginValue == 0 || request.NewBalanceDestinationValue == 0
                    ? "At least one account has a zero balance after the transaction."
                    : "Neither account has a zero balance after the transaction."
            }
        ];
    }

    private static int ClampScore(double score)
    {
        return Math.Clamp((int)Math.Round(score, MidpointRounding.AwayFromZero), 0, 100);
    }

    private static string RiskLevel(int score)
    {
        return score >= 70 ? "High" : score >= 40 ? "Medium" : "Low";
    }

    private static string SuggestedAction(int score)
    {
        return score >= 70 ? "Block transaction immediately" : score >= 40 ? "Manual review required" : "Approve transaction";
    }

    private static string FormatAmount(decimal value)
    {
        return value.ToString("N2", CultureInfo.InvariantCulture);
    }

    private static string NormalizeTransactionType(string transactionType)
    {
        return transactionType.Trim().ToUpperInvariant().Replace(" ", "_");
    }

    private static bool IsCompatibleTensorType(string expectedType, Type actualType)
    {
        return expectedType.Equals("tensor(float)", StringComparison.OrdinalIgnoreCase) && actualType == typeof(float)
            || expectedType.Equals("tensor(string)", StringComparison.OrdinalIgnoreCase) && actualType == typeof(string);
    }

    private sealed class OnnxModelMetadata
    {
        public string ModelName { get; set; } = string.Empty;

        public string? ModelVersion { get; set; }

        public string? ModelTrainingDate { get; set; }

        public List<string> ColumnOrder { get; set; } = [];

        public string InputTensorName { get; set; } = string.Empty;

        public List<OnnxInputTensorMetadata> InputTensors { get; set; } = [];

        public string ProbabilityOutputName { get; set; } = string.Empty;

        public double ClassificationThreshold { get; set; } = 0.5;

        public List<int> Classes { get; set; } = [];

        public int FraudClass { get; set; } = 1;

        public int ProbabilityClassIndex { get; set; }

        public OnnxPreprocessingMetadata Preprocessing { get; set; } = new();
    }

    private sealed class OnnxPreprocessingMetadata
    {
        public bool ScaleNumericFeatures { get; set; }

        public OnnxScalerMetadata? NumericScaler { get; set; }
    }

    private sealed class OnnxInputTensorMetadata
    {
        public string Name { get; set; } = string.Empty;

        public string Feature { get; set; } = string.Empty;

        public string Type { get; set; } = string.Empty;
    }

    private sealed class OnnxScalerMetadata
    {
        public List<string> Features { get; set; } = [];

        public List<double> Mean { get; set; } = [];

        public List<double> Scale { get; set; } = [];
    }
}
