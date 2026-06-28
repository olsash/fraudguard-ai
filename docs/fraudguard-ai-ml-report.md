# FraudGuard-AI: Raport Akademik i Projektit Machine Learning

## 1. Hyrje

FraudGuard-AI është një projekt për zbulimin e transaksioneve mashtruese në pagesa elektronike. Qëllimi kryesor është ndërtimi, krahasimi dhe integrimi i modeleve të machine learning që mund të klasifikojnë një transaksion si jo-mashtrues ose mashtrues, duke përdorur të dhëna mbi llojin e transaksionit, shumën dhe ndryshimet në bilancet e llogarive përpara dhe pas transaksionit.

Zbulimi i mashtrimit është një problem real i machine learning sepse institucionet financiare, platformat e pagesave dhe sistemet bankare përballen me vëllime të mëdha transaksionesh, ndërsa rastet mashtruese janë të rralla, të kushtueshme dhe shpesh ndryshojnë sjellje me kalimin e kohës. Një sistem manual nuk mund të kontrollojë në mënyrë efikase miliona transaksione, prandaj modelet statistikore dhe algoritmet e machine learning janë të përshtatshme për të identifikuar modele të dyshimta në të dhëna.

Projekti përdor dy qasje kryesore. Klasifikimi mbikëqyrur përdoret për të mësuar lidhjen midis karakteristikave të transaksionit dhe variablës së synuar `isFraud`. Kjo qasje është e përshtatshme për parashikim, sepse dataset-i përmban etiketa reale të mashtrimit. Clustering përdoret si analizë e pambikëqyrur për të parë nëse transaksionet formojnë grupe natyrore sipas sjelljes së tyre, pa i dhënë algoritmit etiketën `isFraud`. Kjo ndihmon në interpretimin eksplorues të strukturës së të dhënave, edhe pse modeli kryesor për vendimmarrje mbetet klasifikimi.

## 2. Përshkrimi i Datasetit

Dataset-i i përdorur nga projekti ndodhet në `ml/dataset/fraud.csv`. Në kopjen lokale të analizuar, skedari përmban 6,362,620 rreshta dhe 11 kolona të papërpunuara: `step`, `type`, `amount`, `nameOrig`, `oldbalanceOrg`, `newbalanceOrig`, `nameDest`, `oldbalanceDest`, `newbalanceDest`, `isFraud` dhe `isFlaggedFraud`. Pipeline-i i trajnimit përdor si karakteristika modelimi kolonat `type`, `amount`, `oldbalanceOrg`, `newbalanceOrig`, `oldbalanceDest` dhe `newbalanceDest`, ndërsa variabla e synuar është `isFraud`.

Variabla `isFraud` është binare: vlera 0 tregon transaksion jo-mashtrues dhe vlera 1 tregon transaksion mashtrues. Në dataset-in lokal të analizuar ka 6,354,407 transaksione jo-mashtruese dhe 8,213 transaksione mashtruese. Kjo tregon çekuilibër shumë të lartë klasash, i cili është tipik për zbulimin e mashtrimit.

Karakteristikat kryesore përfaqësojnë informacion financiar dhe kontekst operacional:

- `type`: lloji i transaksionit, me kategori si `CASH_OUT`, `PAYMENT`, `CASH_IN`, `TRANSFER` dhe `DEBIT`.
- `amount`: shuma e transaksionit.
- `oldbalanceOrg` dhe `newbalanceOrig`: bilanci i llogarisë origjinuese para dhe pas transaksionit.
- `oldbalanceDest` dhe `newbalanceDest`: bilanci i llogarisë destinacion para dhe pas transaksionit.
- `isFraud`: etiketa e klasifikimit që tregon nëse transaksioni ishte mashtrues.

Dataset-i është i përshtatshëm për machine learning sepse përmban shumë shembuj, etiketa të qarta binare dhe karakteristika numerike/kategorike që lidhen drejtpërdrejt me sjelljen financiare të transaksioneve. Madhësia e dataset-it lejon trajnimin e modeleve më komplekse, ndërsa çekuilibri i klasave krijon një problem realist ku accuracy nuk mjafton dhe duhen përdorur metrika si precision, recall, F1-score dhe ROC-AUC.

## 3. Metodologjia

Procesi i modelimit bazohet në notebook-un `ml/notebooks/fraud_detection_ml_experiments.ipynb`, skriptet `ml/preprocessing.py` dhe `ml/train_model.py`, si edhe rezultatet e eksportuara në `ml/results/`.

Së pari, të dhënat validohen për të siguruar se kolonat e nevojshme ekzistojnë, se nuk ka vlera mungesë në karakteristikat e përdorura dhe se `isFraud` përmban vetëm vlera binare 0 dhe 1. Pipeline-i përdor vetëm kolonat kryesore të modelimit dhe heq kolonat identifikuese si `nameOrig` dhe `nameDest`, sepse ato nuk janë tipare të përgjithshme të sjelljes financiare.

Ndarja train/test kryhet me `train_test_split`, me `random_state=42` dhe stratifikim kur ka më shumë se një klasë. Kjo ruan shpërndarjen e klasave në të dy nën-bashkësitë dhe e bën eksperimentin më të riprodhueshëm.

Çekuilibri i klasave trajtohet në dy mënyra të dokumentuara në kod. Notebook-u përdor `class_weight="balanced"` për modele si Logistic Regression, Decision Tree dhe Random Forest, ndërsa skripti i retraining krijon edhe një mostër trajnimi më të kontrolluar duke kufizuar numrin e rreshtave jo-mashtrues dhe duke krahasuar Random Forest me dhe pa `class_weight`. Kjo është e rëndësishme sepse një model i patrajtuar mund të arrijë accuracy të lartë duke parashikuar pothuajse gjithmonë klasën shumicë.

Kodimi i karakteristikave realizohet me one-hot encoding për kolonën kategorike `type`. Kolonat numerike janë `amount`, `oldbalanceOrg`, `newbalanceOrig`, `oldbalanceDest` dhe `newbalanceDest`. Modelet e ndjeshme ndaj shkallës, si Logistic Regression, KNN dhe MLPClassifier, përdorin `StandardScaler` në notebook. Skripti i trajnimit ruan edhe artefaktet `columns.pkl` dhe `scaler.pkl`, në mënyrë që API-ja e parashikimit të përdorë të njëjtën skemë karakteristikash.

Feature selection testohet me `SelectKBest(score_func=f_classif, k=5)`. Ky eksperiment zgjedh pesë karakteristikat me lidhjen më të fortë univariate me `isFraud` dhe ritrajnon Random Forest me këtë nën-bashkësi. Në notebook, modeli me të gjitha karakteristikat performon më mirë se varianti i reduktuar, prandaj projekti ruan karakteristikat e plota për modelin kryesor.

Modelet e klasifikimit të testuara janë:

- **Logistic Regression**: model linear dhe i interpretueshëm, i përdorur si baseline.
- **K-Nearest Neighbors**: model i bazuar në distancë, i thjeshtë për t'u kuptuar, por më i kushtueshëm në parashikim kur rritet numri i të dhënave.
- **Decision Tree**: model i interpretueshëm që kap marrëdhënie jolineare, por mund të mbipërshtatet.
- **Random Forest**: ansambël pemësh vendimi që ul variancën dhe rrit stabilitetin krahasuar me një pemë të vetme.
- **Neural Network / MLPClassifier**: model jolinear që teston arkitektura me shtresa të fshehura dhe funksione aktivizimi të ndryshme.

Hyperparameter tuning kryhet me `GridSearchCV` dhe scoring `f1`, me 3-fold cross-validation. F1-score përdoret si metrikë optimizimi sepse kombinon precision dhe recall, gjë që është e përshtatshme në një problem me klasë mashtrimi shumë të rrallë. Grid-et e dokumentuara përfshijnë, ndër të tjera, `C` për Logistic Regression, `n_neighbors` dhe `weights` për KNN, `max_depth`, `min_samples_split` dhe `criterion` për Decision Tree, `n_estimators`, `max_depth` dhe `min_samples_split` për Random Forest, si edhe `hidden_layer_sizes`, `activation` dhe `learning_rate_init` për MLPClassifier.

Clustering realizohet me KMeans pasi hiqet variabla `isFraud`. Tiparet shkallëzohen me `StandardScaler`, testohen vlera të ndryshme të `k`, metoda inicializimi `k-means++` dhe `random`, dhe përdoret PCA për vizualizim dy-dimensional. Etiketa reale `isFraud` përdoret vetëm pas clustering për interpretim, përmes metrikave si Adjusted Rand Index dhe tabelave të krahasimit cluster-label në notebook.

## 4. Rezultatet

Tabela e mëposhtme përdor rezultatet ekzistuese nga `ml/results/model_comparison_results.json`. Test split-i i eksportuar ka 10,000 raste, me 14 raste mashtruese në matricat e konfuzionit.

| Modeli | Accuracy | Precision | Recall | F1-score | ROC-AUC | Confusion Matrix `[[TN, FP], [FN, TP]]` |
|---|---:|---:|---:|---:|---:|---|
| Logistic Regression | 0.9467 | 0.0239 | 0.9286 | 0.0465 | 0.9245 | `[[9454, 532], [1, 13]]` |
| KNN | 0.9994 | 0.9000 | 0.6429 | 0.7500 | 0.8569 | `[[9985, 1], [5, 9]]` |
| Decision Tree | 0.9993 | 0.7692 | 0.7143 | 0.7407 | 0.8570 | `[[9983, 3], [4, 10]]` |
| Random Forest | 0.9997 | 1.0000 | 0.7857 | 0.8800 | 0.9270 | `[[9986, 0], [3, 11]]` |
| Neural Network / MLPClassifier | 0.9996 | 1.0000 | 0.7143 | 0.8333 | 0.9720 | `[[9986, 0], [4, 10]]` |

Accuracy është shumë e lartë për disa modele, por kjo metrikë duhet interpretuar me kujdes për shkak të çekuilibrit ekstrem të klasave. Logistic Regression arrin recall të lartë, por precision shumë të ulët, sepse prodhon 532 false positives. Kjo do të krijonte shumë alarme të panevojshme në një sistem real. KNN dhe Decision Tree kanë performancë të mirë, por kanë F1-score më të ulët se Random Forest.

Random Forest është modeli më i mirë në krahasimin kryesor sepse ka F1-score më të lartë (0.8800), precision 1.0000, recall 0.7857 dhe asnjë false positive në test split-in e regjistruar. Neural Network ka ROC-AUC më të lartë (0.9720), por F1-score dhe recall më të ulët se Random Forest në pragun e përdorur. Për këtë arsye, Random Forest është zgjedhur si modeli më praktik për projektin: ai ka balancë të mirë midis kapjes së mashtrimeve dhe shmangies së alarmeve të rreme, si edhe mbështet interpretim përmes feature importance dhe SHAP.

## 5. Diskutimi

Random Forest funksionon mirë për këtë dataset sepse kombinon shumë pemë vendimi dhe mund të kapë marrëdhënie jolineare midis shumës, llojit të transaksionit dhe ndryshimeve të bilanceve. Në të dhënat e mashtrimit, sinjalet nuk janë domosdoshmërisht lineare: për shembull, një shumë e lartë mund të jetë më e dyshimtë kur kombinohet me një `TRANSFER` ose `CASH_OUT` dhe me bilance që ndryshojnë në mënyrë jo të pritshme. Random Forest i modelon këto ndërveprime më mirë se një model linear i thjeshtë.

False positives dhe false negatives kanë kuptime të ndryshme operative. Një false positive është transaksion legjitim i shënuar si mashtrim; ai mund të shkaktojë vonesa, shqetësim për klientin dhe ngarkesë për ekipin e review. Një false negative është transaksion mashtrues i kaluar si normal; ai zakonisht është më i kushtueshëm sepse lejon humbje financiare. Në rezultatet e eksportuara, Random Forest ka 0 false positives dhe 3 false negatives, ndërsa MLP ka 0 false positives dhe 4 false negatives. Logistic Regression kap 13 nga 14 rastet mashtruese, por krijon 532 false positives, gjë që e bën më pak praktik si model i vetëm vendimmarrës.

Eksperimenti me `SelectKBest` tregon se reduktimi i tipareve nuk përmirësoi performancën e Random Forest. Notebook-u dokumenton se Random Forest pas `SelectKBest(k=5)` arriti accuracy 0.9981, precision 0.3529, recall 0.4286, F1-score 0.3871 dhe ROC-AUC 0.7840 me matricë konfuzioni `[[9975, 11], [8, 6]]`. Kjo performancë është shumë më e dobët se Random Forest me të gjitha karakteristikat. Arsyeja është se `SelectKBest` vlerëson tiparet në mënyrë univariate dhe nuk kap mirë ndërveprimet jolineare midis bilanceve, shumës dhe llojit të transaksionit.

Ndryshimet në arkitekturën e Neural Network ndikojnë në performancë. Notebook-u teston konfigurime si një shtresë me 32 neurone, një shtresë me 64 neurone, arkitekturë 64-32, aktivizime `relu` dhe `tanh`, si edhe learning rate të ndryshëm. `GridSearchCV` zgjodhi konfigurimin `hidden_layer_sizes=(32,)`, `activation="tanh"` dhe `learning_rate_init=0.01`. Edhe pse MLPClassifier arriti ROC-AUC të lartë, ai është më pak i interpretueshëm se Random Forest dhe kërkon më shumë kujdes në shkallëzim, kalibrim dhe monitorim.

Clustering me KMeans nuk duhet interpretuar si zëvendësim për klasifikimin mbikëqyrur. Notebook-u largon `isFraud` para clustering dhe e përdor atë vetëm për krahasim pas trajnimit. KMeans kërkon grupe gjeometrikisht kompakte në hapësirën e tipareve, ndërsa mashtrimi është i rrallë dhe mund të shfaqet në forma të ndryshme. Në versionin aktual të `ml/results/` nuk ka eksport numerik `clustering_results.json` ose `clustering_results.csv`, prandaj ky raport nuk paraqet vlera të shpikura për silhouette score ose Adjusted Rand Index. Interpretimi i notebook-ut është se clustering është më i dobishëm për segmentim eksplorues të sjelljes së transaksioneve sesa për vendim final fraud/non-fraud.

## 6. Përfundimi

Projekti FraudGuard-AI realizon një pipeline të plotë për zbulimin e mashtrimit në transaksione financiare. Ai përfshin validimin dhe parapërpunimin e dataset-it, kodimin e tipareve kategorike, shkallëzimin aty ku nevojitet, trajtimin e çekuilibrit të klasave, feature selection, tuning me `GridSearchCV`, krahasimin e pesë klasifikuesve dhe analizën eksploruese me KMeans/PCA.

Rezultatet tregojnë se Random Forest është modeli më i përshtatshëm në krahasimin kryesor, sepse arrin F1-score më të lartë dhe një balancë të mirë midis precision dhe recall. Projekti gjithashtu përfshin një aplikacion full-stack: FastAPI shërben modelin ML për parashikim, ASP.NET Core menaxhon autentikimin, transaksionet, parashikimet, alertet, raportet dhe funksionet administrative, ndërsa React/Vite ofron dashboard për përdoruesit dhe administratorët. Aplikacioni mbështet prediction, admin review, model comparison dhe raporte.

Përmirësime të mundshme në të ardhmen përfshijnë eksportimin e plotë të rezultateve të clustering në `ml/results/`, kalibrimin e pragut të vendimmarrjes sipas kostos së false positives dhe false negatives, monitorimin e drift-it të të dhënave, validim më të gjerë me cross-validation në dataset-in e plotë, krahasim me metoda shtesë për imbalance handling dhe integrim më të detajuar të shpjegueshmërisë për çdo parashikim individual.

## 7. Referencat

- Pedregosa, F. et al. scikit-learn: Machine Learning in Python. Përdorur për `LogisticRegression`, `KNeighborsClassifier`, `DecisionTreeClassifier`, `RandomForestClassifier`, `MLPClassifier`, `GridSearchCV`, `SelectKBest`, `KMeans`, `PCA` dhe metrikat e vlerësimit.
- pandas documentation. Përdorur për leximin, validimin, përpunimin dhe eksportimin e të dhënave tabulare.
- NumPy documentation. Përdorur për operacione numerike dhe përpunim të vargjeve.
- FastAPI documentation. Përdorur për shërbimin Python të parashikimit në `ml/api/app.py`.
- ASP.NET Core documentation. Përdorur për backend API, autentikim, controllers, services dhe integrim me ML API.
- React documentation dhe Vite documentation. Përdorur për frontend-in e dashboard-it, prediction workflow, model comparison dhe reports.
- Dataset-i i projektit: `ml/dataset/fraud.csv`, i përshkruar në repository si PaySim-style online payment fraud dataset. Repository nuk përfshin një URL publike të dataset-it, prandaj nuk është shtuar një burim i jashtëm i paverifikuar.
