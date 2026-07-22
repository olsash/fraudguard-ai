using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace FraudGuard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUserControlledBankAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BankAccounts_Users_UserId",
                table: "BankAccounts");

            migrationBuilder.DropIndex(
                name: "IX_BankAccounts_UserId",
                table: "BankAccounts");

            migrationBuilder.UpdateData(
                table: "Beneficiaries",
                keyColumn: "Id",
                keyValue: 1,
                column: "DestinationBankAccountId",
                value: null);

            migrationBuilder.DeleteData(
                table: "BankAccounts",
                keyColumn: "Id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "BankAccounts",
                keyColumn: "Id",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "BankAccounts",
                keyColumn: "Id",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "BankAccounts",
                keyColumn: "Id",
                keyValue: 4);

            migrationBuilder.AlterColumn<int>(
                name: "UserId",
                table: "BankAccounts",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<string>(
                name: "AccountName",
                table: "BankAccounts",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "Simulated Account");

            migrationBuilder.UpdateData(
                table: "BankAccounts",
                keyColumn: "Id",
                keyValue: 5,
                columns: new[] { "AccountName", "UserId" },
                values: new object[] { "Demo Merchant Settlement", null });

            migrationBuilder.UpdateData(
                table: "BankAccounts",
                keyColumn: "Id",
                keyValue: 6,
                columns: new[] { "AccountName", "UserId" },
                values: new object[] { "Demo Merchant Settlement", null });

            migrationBuilder.CreateIndex(
                name: "IX_BankAccounts_UserId_BankId_AccountType",
                table: "BankAccounts",
                columns: new[] { "UserId", "BankId", "AccountType" },
                unique: true,
                filter: "[UserId] IS NOT NULL AND [IsActive] = 1");

            migrationBuilder.AddForeignKey(
                name: "FK_BankAccounts_Users_UserId",
                table: "BankAccounts",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BankAccounts_Users_UserId",
                table: "BankAccounts");

            migrationBuilder.DropIndex(
                name: "IX_BankAccounts_UserId_BankId_AccountType",
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "AccountName",
                table: "BankAccounts");

            migrationBuilder.AlterColumn<int>(
                name: "UserId",
                table: "BankAccounts",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.UpdateData(
                table: "BankAccounts",
                keyColumn: "Id",
                keyValue: 5,
                column: "UserId",
                value: 2);

            migrationBuilder.UpdateData(
                table: "BankAccounts",
                keyColumn: "Id",
                keyValue: 6,
                column: "UserId",
                value: 2);

            migrationBuilder.InsertData(
                table: "BankAccounts",
                columns: new[] { "Id", "AccountNumber", "AccountType", "BankId", "CreatedAt", "Currency", "CurrentBalance", "IBAN", "IsActive", "UpdatedAt", "UserId" },
                values: new object[,]
                {
                    { 1, "FGD-1000004821", "Checking", 1, new DateTime(2026, 1, 2, 0, 0, 0, 0, DateTimeKind.Utc), "EUR", 12850.45m, "XK051212000000004821", true, null, 1 },
                    { 2, "FGD-1000007394", "Savings", 2, new DateTime(2026, 1, 2, 0, 0, 0, 0, DateTimeKind.Utc), "EUR", 5400.00m, "XK051212000000007394", true, null, 1 },
                    { 3, "FGD-2000001188", "Operations", 3, new DateTime(2026, 1, 2, 0, 0, 0, 0, DateTimeKind.Utc), "EUR", 25000.00m, "XK051212000000001188", true, null, 2 },
                    { 4, "FGD-1000006650", "Travel", 4, new DateTime(2026, 1, 2, 0, 0, 0, 0, DateTimeKind.Utc), "USD", 2400.25m, "XK051212000000006650", false, null, 1 }
                });

            migrationBuilder.UpdateData(
                table: "Beneficiaries",
                keyColumn: "Id",
                keyValue: 1,
                column: "DestinationBankAccountId",
                value: 3);

            migrationBuilder.CreateIndex(
                name: "IX_BankAccounts_UserId",
                table: "BankAccounts",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_BankAccounts_Users_UserId",
                table: "BankAccounts",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
