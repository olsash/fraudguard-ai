using FraudGuard.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FraudGuard.Api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260723052000_SimplifyFraudCaseReviewWorkflow")]
    public partial class SimplifyFraudCaseReviewWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE FraudCases
                SET Status = 'UnderReview',
                    ReviewStartedAt = COALESCE(ReviewStartedAt, AssignedAt, UpdatedAt, CreatedAt),
                    UpdatedAt = SYSUTCDATETIME()
                WHERE Status IN ('Assigned', 'Escalated')
                  AND ResolvedAt IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // This migration is a workflow simplification data backfill. It is intentionally not reversible:
            // both previous unresolved statuses map to the single active review state.
        }
    }
}
