using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FraudGuard.Api.Migrations
{
    /// <inheritdoc />
    public partial class UpdateDemoEmailDomain : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE [u]
                SET [Email] = CONCAT(LEFT([u].[Email], LEN([u].[Email]) - LEN('@credit.com')), '@fraudguard.com'),
                    [UpdatedAt] = SYSUTCDATETIME()
                FROM [Users] AS [u]
                WHERE RIGHT([u].[Email], LEN('@credit.com')) = '@credit.com'
                  AND NOT EXISTS (
                      SELECT 1
                      FROM [Users] AS [existing]
                      WHERE [existing].[Id] <> [u].[Id]
                        AND [existing].[Email] = CONCAT(LEFT([u].[Email], LEN([u].[Email]) - LEN('@credit.com')), '@fraudguard.com')
                  );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE [u]
                SET [Email] = CONCAT(LEFT([u].[Email], LEN([u].[Email]) - LEN('@fraudguard.com')), '@credit.com'),
                    [UpdatedAt] = SYSUTCDATETIME()
                FROM [Users] AS [u]
                WHERE RIGHT([u].[Email], LEN('@fraudguard.com')) = '@fraudguard.com'
                  AND [u].[Email] IN ('admin@fraudguard.com', 'user@fraudguard.com')
                  AND NOT EXISTS (
                      SELECT 1
                      FROM [Users] AS [existing]
                      WHERE [existing].[Id] <> [u].[Id]
                        AND [existing].[Email] = CONCAT(LEFT([u].[Email], LEN([u].[Email]) - LEN('@fraudguard.com')), '@credit.com')
                  );
                """);
        }
    }
}
