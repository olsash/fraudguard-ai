# FraudGuard API

Run these commands from `backend/FraudGuard.Api` after SQL Server is available:

```bash
dotnet ef migrations add InitialAuthUsers
dotnet ef database update
dotnet run
```

Default accounts:

- `admin@credit.com` / `admin123`
- `user@credit.com` / `user123`

Login endpoint:

```http
POST /api/auth/login
```
