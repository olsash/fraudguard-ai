using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace FraudGuard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVerifiedDemoBankAccountRegistry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AccountHolderName",
                table: "BankAccounts",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "Simulated Account Holder");

            migrationBuilder.CreateTable(
                name: "BankAccountVerificationAttempts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    AccountLookupHash = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    AttemptedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BankAccountVerificationAttempts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DemoBankAccounts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BankId = table.Column<int>(type: "int", nullable: false),
                    AccountHolderName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    AccountNumber = table.Column<string>(type: "nvarchar(34)", maxLength: 34, nullable: false),
                    Iban = table.Column<string>(type: "nvarchar(34)", maxLength: 34, nullable: false),
                    AccountType = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    CurrentBalance = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    VerificationCodeHash = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    IsLinked = table.Column<bool>(type: "bit", nullable: false),
                    LinkedUserId = table.Column<int>(type: "int", nullable: true),
                    LinkedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DemoBankAccounts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DemoBankAccounts_Banks_BankId",
                        column: x => x.BankId,
                        principalTable: "Banks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DemoBankAccounts_Users_LinkedUserId",
                        column: x => x.LinkedUserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.UpdateData(
                table: "BankAccounts",
                keyColumn: "Id",
                keyValue: 5,
                column: "AccountHolderName",
                value: "Demo Merchant Settlement");

            migrationBuilder.UpdateData(
                table: "BankAccounts",
                keyColumn: "Id",
                keyValue: 6,
                column: "AccountHolderName",
                value: "Demo Merchant Settlement");

            migrationBuilder.InsertData(
                table: "DemoBankAccounts",
                columns: new[] { "Id", "AccountHolderName", "AccountNumber", "AccountType", "BankId", "CreatedAt", "Currency", "CurrentBalance", "Iban", "IsActive", "IsLinked", "LinkedAt", "LinkedUserId", "UpdatedAt", "VerificationCodeHash" },
                values: new object[,]
                {
                    { 1, "Fiona Ajeti", "1000123456", "Current", 1, new DateTime(2026, 1, 4, 0, 0, 0, 0, DateTimeKind.Utc), "EUR", 5000m, "XK051234567890123456", true, false, null, null, null, "3C42482F6E55E0AE0D7AC677470207609DD82F6C9427236AD1CE6AD01169C2C0" },
                    { 2, "Arben Krasniqi", "2000123456", "Savings", 2, new DateTime(2026, 1, 4, 0, 0, 0, 0, DateTimeKind.Utc), "EUR", 10000m, "XK052234567890123456", true, false, null, null, null, "883B3DC1D5E43A37C72D6135BFD60D022299844D82DF4EB6B92A795CB9C6EA6D" },
                    { 3, "Lira Gashi", "3000123456", "Current", 3, new DateTime(2026, 1, 4, 0, 0, 0, 0, DateTimeKind.Utc), "EUR", 7200m, "XK053234567890123456", true, false, null, null, null, "2F89629F0EA3F530A487C1A87B205F859D886A08CFEAB7D4228D3762767D705B" },
                    { 4, "Dardan Berisha", "4000123456", "Savings", 4, new DateTime(2026, 1, 4, 0, 0, 0, 0, DateTimeKind.Utc), "EUR", 12500m, "XK054234567890123456", true, false, null, null, null, "AAF87529516EB6F4FE3874236DB5AC9D80B77335442ECD5B63058B8102D905B1" },
                    { 5, "Elira Morina", "5000123456", "Current", 5, new DateTime(2026, 1, 4, 0, 0, 0, 0, DateTimeKind.Utc), "EUR", 6400m, "XK055234567890123456", true, false, null, null, null, "E2AF2C7BE4BBD46FBEB0E4EFC1168E1E38CF58BC7274E836AE545E12963DB8C8" },
                    { 6, "Besnik Hoxha", "6000123456", "Savings", 6, new DateTime(2026, 1, 4, 0, 0, 0, 0, DateTimeKind.Utc), "EUR", 15000m, "XK056234567890123456", true, false, null, null, null, "1FA8D8C467FBEE252AE084414E3FD6271F1F391D19CFFAB0D78CCBC20F7404A7" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_BankAccountVerificationAttempts_UserId_AccountLookupHash_AttemptedAt",
                table: "BankAccountVerificationAttempts",
                columns: new[] { "UserId", "AccountLookupHash", "AttemptedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_DemoBankAccounts_AccountNumber",
                table: "DemoBankAccounts",
                column: "AccountNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DemoBankAccounts_BankId",
                table: "DemoBankAccounts",
                column: "BankId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoBankAccounts_Iban",
                table: "DemoBankAccounts",
                column: "Iban",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DemoBankAccounts_LinkedUserId",
                table: "DemoBankAccounts",
                column: "LinkedUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BankAccountVerificationAttempts");

            migrationBuilder.DropTable(
                name: "DemoBankAccounts");

            migrationBuilder.DropColumn(
                name: "AccountHolderName",
                table: "BankAccounts");
        }
    }
}
