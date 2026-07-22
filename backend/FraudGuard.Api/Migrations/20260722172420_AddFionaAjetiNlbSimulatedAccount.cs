using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FraudGuard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFionaAjetiNlbSimulatedAccount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "DemoBankAccounts",
                columns: new[] { "Id", "AccountHolderName", "AccountNumber", "AccountType", "BankId", "CreatedAt", "Currency", "CurrentBalance", "Iban", "IsActive", "IsLinked", "LinkedAt", "LinkedUserId", "UpdatedAt", "VerificationCodeHash" },
                values: new object[] { 7, "Fiona Ajeti", "3100102157", "Current", 3, new DateTime(2026, 1, 4, 0, 0, 0, 0, DateTimeKind.Utc), "EUR", 8300m, "XK053100102157000001", true, false, null, null, null, "F724A30965E1FBA1EA7CA65F0B0D600572D0D61081053F7C0483DBC66F569C32" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 7);
        }
    }
}
