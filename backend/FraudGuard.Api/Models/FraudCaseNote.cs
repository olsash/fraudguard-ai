using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models;

public class FraudCaseNote
{
    public int Id { get; set; }

    public int FraudCaseId { get; set; }

    public FraudCase? FraudCase { get; set; }

    public int AnalystId { get; set; }

    public User? Analyst { get; set; }

    [MaxLength(2000)]
    public string Comment { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}
