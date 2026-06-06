using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace FraudGuard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTransactions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Transactions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Merchant = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Country = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    RiskScore = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TransactionType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Transactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Transactions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Transactions",
                columns: new[] { "Id", "Amount", "Category", "Country", "CreatedAt", "Currency", "Description", "Merchant", "RiskScore", "Status", "TransactionType", "UserId" },
                values: new object[,]
                {
                    { 1, 129.99m, "Retail", "United States", new DateTime(2026, 1, 2, 10, 15, 0, 0, DateTimeKind.Utc), "USD", "Office equipment purchase", "Amazon", 18, "safe", "PAYMENT", 1 },
                    { 2, 4250m, "Money Transfer", "Nigeria", new DateTime(2026, 1, 3, 2, 35, 0, 0, DateTimeKind.Utc), "USD", "High-value transfer to new destination", "QuickCash Transfer", 78, "fraud", "TRANSFER", 1 },
                    { 3, 860m, "Travel", "Germany", new DateTime(2026, 1, 4, 18, 20, 0, 0, DateTimeKind.Utc), "USD", "Travel booking flagged for review", "Booking", 44, "review", "PAYMENT", 2 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_CreatedAt",
                table: "Transactions",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_Status",
                table: "Transactions",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_UserId",
                table: "Transactions",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Transactions");
        }
    }
}
