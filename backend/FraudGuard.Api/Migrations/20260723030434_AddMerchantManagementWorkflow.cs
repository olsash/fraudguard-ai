using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace FraudGuard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMerchantManagementWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Merchants_BankAccounts_SettlementBankAccountId",
                table: "Merchants");

            migrationBuilder.DropIndex(
                name: "IX_Merchants_SettlementBankAccountId",
                table: "Merchants");

            migrationBuilder.AddColumn<DateTime>(
                name: "CompletedAt",
                table: "Transactions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DestinationBankAccountId",
                table: "Transactions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RejectedAt",
                table: "Transactions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Merchants",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(150)",
                oldMaxLength: 150);

            migrationBuilder.AddColumn<int>(
                name: "BankId",
                table: "Merchants",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsVerified",
                table: "Merchants",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "MerchantCategoryCode",
                table: "Merchants",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MerchantCode",
                table: "Merchants",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "Merchants",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<int>(
                name: "MerchantId",
                table: "BankAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE merchant
                SET
                    BankId = CASE WHEN merchant.BankId = 0 THEN COALESCE(account.BankId, 1) ELSE merchant.BankId END,
                    MerchantCode = CASE WHEN merchant.MerchantCode = '' THEN CONCAT('MERCHANT-', merchant.Id) ELSE merchant.MerchantCode END,
                    IsVerified = CASE WHEN merchant.IsActive = 1 THEN 1 ELSE merchant.IsVerified END
                FROM Merchants merchant
                LEFT JOIN BankAccounts account ON account.Id = merchant.SettlementBankAccountId;

                WITH duplicatedSettlement AS (
                    SELECT
                        Id,
                        ROW_NUMBER() OVER (PARTITION BY SettlementBankAccountId ORDER BY Id) AS RowNumber
                    FROM Merchants
                    WHERE SettlementBankAccountId IS NOT NULL
                )
                UPDATE Merchants
                SET SettlementBankAccountId = NULL
                WHERE Id IN (
                    SELECT Id
                    FROM duplicatedSettlement
                    WHERE RowNumber > 1
                );
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_DestinationBankAccountId",
                table: "Transactions",
                column: "DestinationBankAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_Merchants_BankId",
                table: "Merchants",
                column: "BankId");

            migrationBuilder.CreateIndex(
                name: "IX_Merchants_IsActive",
                table: "Merchants",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Merchants_MerchantCode",
                table: "Merchants",
                column: "MerchantCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Merchants_SettlementBankAccountId",
                table: "Merchants",
                column: "SettlementBankAccountId",
                unique: true,
                filter: "[SettlementBankAccountId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_BankAccounts_MerchantId",
                table: "BankAccounts",
                column: "MerchantId");

            migrationBuilder.AddForeignKey(
                name: "FK_BankAccounts_Merchants_MerchantId",
                table: "BankAccounts",
                column: "MerchantId",
                principalTable: "Merchants",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Merchants_BankAccounts_SettlementBankAccountId",
                table: "Merchants",
                column: "SettlementBankAccountId",
                principalTable: "BankAccounts",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Merchants_Banks_BankId",
                table: "Merchants",
                column: "BankId",
                principalTable: "Banks",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Transactions_BankAccounts_DestinationBankAccountId",
                table: "Transactions",
                column: "DestinationBankAccountId",
                principalTable: "BankAccounts",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BankAccounts_Merchants_MerchantId",
                table: "BankAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_Merchants_BankAccounts_SettlementBankAccountId",
                table: "Merchants");

            migrationBuilder.DropForeignKey(
                name: "FK_Merchants_Banks_BankId",
                table: "Merchants");

            migrationBuilder.DropForeignKey(
                name: "FK_Transactions_BankAccounts_DestinationBankAccountId",
                table: "Transactions");

            migrationBuilder.DropIndex(
                name: "IX_Transactions_DestinationBankAccountId",
                table: "Transactions");

            migrationBuilder.DropIndex(
                name: "IX_Merchants_BankId",
                table: "Merchants");

            migrationBuilder.DropIndex(
                name: "IX_Merchants_IsActive",
                table: "Merchants");

            migrationBuilder.DropIndex(
                name: "IX_Merchants_MerchantCode",
                table: "Merchants");

            migrationBuilder.DropIndex(
                name: "IX_Merchants_SettlementBankAccountId",
                table: "Merchants");

            migrationBuilder.DropIndex(
                name: "IX_BankAccounts_MerchantId",
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "CompletedAt",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "DestinationBankAccountId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "RejectedAt",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "BankId",
                table: "Merchants");

            migrationBuilder.DropColumn(
                name: "IsVerified",
                table: "Merchants");

            migrationBuilder.DropColumn(
                name: "MerchantCategoryCode",
                table: "Merchants");

            migrationBuilder.DropColumn(
                name: "MerchantCode",
                table: "Merchants");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "Merchants");

            migrationBuilder.DropColumn(
                name: "MerchantId",
                table: "BankAccounts");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Merchants",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100);

            migrationBuilder.CreateIndex(
                name: "IX_Merchants_SettlementBankAccountId",
                table: "Merchants",
                column: "SettlementBankAccountId");

            migrationBuilder.AddForeignKey(
                name: "FK_Merchants_BankAccounts_SettlementBankAccountId",
                table: "Merchants",
                column: "SettlementBankAccountId",
                principalTable: "BankAccounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
