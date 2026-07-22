# FraudGuard API

Run these commands from `backend/FraudGuard.Api` after SQL Server is available:

```bash
dotnet ef migrations add InitialAuthUsers
dotnet ef database update
dotnet run
```

Default accounts:

- `admin@fraudguard.com` / `admin123`
- `analyst@fraudguard.com` / `analyst123` (Development only)
- `user@fraudguard.com` / `user123`

Login endpoint:

```http
POST /api/auth/login
```
