using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FraudGuard.Api.Migrations
{
    /// <inheritdoc />
    public partial class TransactionCenteredFraudFlow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "RiskScore",
                table: "Transactions",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<double>(
                name: "Confidence",
                table: "Predictions",
                type: "float",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.CreateTable(
                name: "FraudAlerts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    TransactionId = table.Column<int>(type: "int", nullable: false),
                    PredictionId = table.Column<int>(type: "int", nullable: true),
                    Title = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Severity = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    RiskScore = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FraudAlerts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FraudAlerts_Predictions_PredictionId",
                        column: x => x.PredictionId,
                        principalTable: "Predictions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_FraudAlerts_Transactions_TransactionId",
                        column: x => x.TransactionId,
                        principalTable: "Transactions",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_FraudAlerts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_FraudAlerts_PredictionId",
                table: "FraudAlerts",
                column: "PredictionId");

            migrationBuilder.CreateIndex(
                name: "IX_FraudAlerts_Status",
                table: "FraudAlerts",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_FraudAlerts_TransactionId",
                table: "FraudAlerts",
                column: "TransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_FraudAlerts_TransactionId_Status",
                table: "FraudAlerts",
                columns: new[] { "TransactionId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_FraudAlerts_UserId",
                table: "FraudAlerts",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FraudAlerts");

            migrationBuilder.DropColumn(
                name: "Confidence",
                table: "Predictions");

            migrationBuilder.AlterColumn<int>(
                name: "RiskScore",
                table: "Transactions",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);
        }
    }
}
