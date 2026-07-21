using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FraudGuard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFraudCaseTransactionProcessing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IdempotencyKey",
                table: "Transactions",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProcessingStatus",
                table: "Transactions",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "FraudCases",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TransactionId = table.Column<int>(type: "int", nullable: false),
                    PredictionId = table.Column<int>(type: "int", nullable: true),
                    FraudAlertId = table.Column<int>(type: "int", nullable: true),
                    AssignedAnalystId = table.Column<int>(type: "int", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Priority = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ModelRiskScore = table.Column<int>(type: "int", nullable: false),
                    ModelDecision = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    FinalDecision = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    AnalystComment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FraudCases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FraudCases_FraudAlerts_FraudAlertId",
                        column: x => x.FraudAlertId,
                        principalTable: "FraudAlerts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_FraudCases_Predictions_PredictionId",
                        column: x => x.PredictionId,
                        principalTable: "Predictions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_FraudCases_Transactions_TransactionId",
                        column: x => x.TransactionId,
                        principalTable: "Transactions",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_FraudCases_Users_AssignedAnalystId",
                        column: x => x.AssignedAnalystId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.UpdateData(
                table: "Transactions",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "IdempotencyKey", "ProcessingStatus" },
                values: new object[] { null, "Completed" });

            migrationBuilder.UpdateData(
                table: "Transactions",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "IdempotencyKey", "ProcessingStatus" },
                values: new object[] { null, "Rejected" });

            migrationBuilder.UpdateData(
                table: "Transactions",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "IdempotencyKey", "ProcessingStatus" },
                values: new object[] { null, "PendingReview" });

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_UserId_IdempotencyKey",
                table: "Transactions",
                columns: new[] { "UserId", "IdempotencyKey" },
                unique: true,
                filter: "[IdempotencyKey] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_FraudCases_AssignedAnalystId",
                table: "FraudCases",
                column: "AssignedAnalystId");

            migrationBuilder.CreateIndex(
                name: "IX_FraudCases_CreatedAt",
                table: "FraudCases",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_FraudCases_FraudAlertId",
                table: "FraudCases",
                column: "FraudAlertId");

            migrationBuilder.CreateIndex(
                name: "IX_FraudCases_PredictionId",
                table: "FraudCases",
                column: "PredictionId");

            migrationBuilder.CreateIndex(
                name: "IX_FraudCases_Priority",
                table: "FraudCases",
                column: "Priority");

            migrationBuilder.CreateIndex(
                name: "IX_FraudCases_Status",
                table: "FraudCases",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_FraudCases_TransactionId",
                table: "FraudCases",
                column: "TransactionId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FraudCases");

            migrationBuilder.DropIndex(
                name: "IX_Transactions_UserId_IdempotencyKey",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "IdempotencyKey",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "ProcessingStatus",
                table: "Transactions");
        }
    }
}
