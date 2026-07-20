using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace FraudGuard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDemoBankingDomain : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BeneficiaryId",
                table: "Transactions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MerchantId",
                table: "Transactions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SourceBankAccountId",
                table: "Transactions",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Banks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Country = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SwiftCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Banks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BankAccounts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    BankId = table.Column<int>(type: "int", nullable: false),
                    AccountNumber = table.Column<string>(type: "nvarchar(34)", maxLength: 34, nullable: false),
                    IBAN = table.Column<string>(type: "nvarchar(34)", maxLength: 34, nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    CurrentBalance = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    AccountType = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BankAccounts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BankAccounts_Banks_BankId",
                        column: x => x.BankId,
                        principalTable: "Banks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BankAccounts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Beneficiaries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    BankId = table.Column<int>(type: "int", nullable: false),
                    DestinationBankAccountId = table.Column<int>(type: "int", nullable: true),
                    MaskedAccountReference = table.Column<string>(type: "nvarchar(34)", maxLength: 34, nullable: false),
                    IsTrusted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Beneficiaries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Beneficiaries_BankAccounts_DestinationBankAccountId",
                        column: x => x.DestinationBankAccountId,
                        principalTable: "BankAccounts",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Beneficiaries_Banks_BankId",
                        column: x => x.BankId,
                        principalTable: "Banks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Beneficiaries_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Merchants",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Country = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SettlementBankAccountId = table.Column<int>(type: "int", nullable: true),
                    RiskLevel = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Merchants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Merchants_BankAccounts_SettlementBankAccountId",
                        column: x => x.SettlementBankAccountId,
                        principalTable: "BankAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.InsertData(
                table: "Banks",
                columns: new[] { "Id", "Country", "CreatedAt", "IsActive", "Name", "SwiftCode", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, "Kosovo", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, "Raiffeisen Bank Kosovo", "RBKODEMO", null },
                    { 2, "Kosovo", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, "ProCredit Bank Kosovo", "PCBKKDEMO", null },
                    { 3, "Kosovo", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, "NLB Banka", "NLBADEMO", null },
                    { 4, "Kosovo", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, "TEB Bank", "TEBKDEMO", null },
                    { 5, "Kosovo", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, "BKT Kosovo", "BKTKDEMO", null },
                    { 6, "Kosovo", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, "Banka Ekonomike", "BEKODEMO", null }
                });

            migrationBuilder.UpdateData(
                table: "Transactions",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "BeneficiaryId", "MerchantId", "SourceBankAccountId" },
                values: new object[] { null, null, null });

            migrationBuilder.UpdateData(
                table: "Transactions",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "BeneficiaryId", "MerchantId", "SourceBankAccountId" },
                values: new object[] { null, null, null });

            migrationBuilder.UpdateData(
                table: "Transactions",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "BeneficiaryId", "MerchantId", "SourceBankAccountId" },
                values: new object[] { null, null, null });

            migrationBuilder.InsertData(
                table: "BankAccounts",
                columns: new[] { "Id", "AccountNumber", "AccountType", "BankId", "CreatedAt", "Currency", "CurrentBalance", "IBAN", "IsActive", "UpdatedAt", "UserId" },
                values: new object[,]
                {
                    { 1, "FGD-1000004821", "Checking", 1, new DateTime(2026, 1, 2, 0, 0, 0, 0, DateTimeKind.Utc), "EUR", 12850.45m, "XK051212000000004821", true, null, 1 },
                    { 2, "FGD-1000007394", "Savings", 2, new DateTime(2026, 1, 2, 0, 0, 0, 0, DateTimeKind.Utc), "EUR", 5400.00m, "XK051212000000007394", true, null, 1 },
                    { 3, "FGD-2000001188", "Operations", 3, new DateTime(2026, 1, 2, 0, 0, 0, 0, DateTimeKind.Utc), "EUR", 25000.00m, "XK051212000000001188", true, null, 2 },
                    { 4, "FGD-1000006650", "Travel", 4, new DateTime(2026, 1, 2, 0, 0, 0, 0, DateTimeKind.Utc), "USD", 2400.25m, "XK051212000000006650", false, null, 1 },
                    { 5, "FGD-MERCH-4102", "Merchant Settlement", 5, new DateTime(2026, 1, 2, 0, 0, 0, 0, DateTimeKind.Utc), "EUR", 82000.00m, "XK051212000000014102", true, null, 2 },
                    { 6, "FGD-MERCH-9820", "Merchant Settlement", 6, new DateTime(2026, 1, 2, 0, 0, 0, 0, DateTimeKind.Utc), "EUR", 64000.00m, "XK051212000000019820", true, null, 2 }
                });

            migrationBuilder.InsertData(
                table: "Beneficiaries",
                columns: new[] { "Id", "BankId", "CreatedAt", "DestinationBankAccountId", "FullName", "IsTrusted", "MaskedAccountReference", "UpdatedAt", "UserId" },
                values: new object[,]
                {
                    { 2, 6, new DateTime(2026, 1, 3, 0, 0, 0, 0, DateTimeKind.Utc), null, "Demo Supplier Account", false, "•••• 7742", null, 1 },
                    { 1, 3, new DateTime(2026, 1, 3, 0, 0, 0, 0, DateTimeKind.Utc), 3, "Demo Family Transfer", true, "•••• 1188", null, 1 }
                });

            migrationBuilder.InsertData(
                table: "Merchants",
                columns: new[] { "Id", "Category", "Country", "CreatedAt", "IsActive", "Name", "RiskLevel", "SettlementBankAccountId", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, "Retail", "Kosovo", new DateTime(2026, 1, 3, 0, 0, 0, 0, DateTimeKind.Utc), true, "Demo Market Prishtina", "Low", 5, null },
                    { 2, "Travel", "Kosovo", new DateTime(2026, 1, 3, 0, 0, 0, 0, DateTimeKind.Utc), true, "Demo Travel Agency", "Medium", 6, null },
                    { 3, "E-Commerce", "Kosovo", new DateTime(2026, 1, 3, 0, 0, 0, 0, DateTimeKind.Utc), true, "Demo Electronics Store", "Low", 5, null },
                    { 4, "Crypto", "Kosovo", new DateTime(2026, 1, 3, 0, 0, 0, 0, DateTimeKind.Utc), true, "Demo Crypto Exchange", "High", 6, null }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_BeneficiaryId",
                table: "Transactions",
                column: "BeneficiaryId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_MerchantId",
                table: "Transactions",
                column: "MerchantId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_SourceBankAccountId",
                table: "Transactions",
                column: "SourceBankAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_BankAccounts_AccountNumber",
                table: "BankAccounts",
                column: "AccountNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BankAccounts_BankId",
                table: "BankAccounts",
                column: "BankId");

            migrationBuilder.CreateIndex(
                name: "IX_BankAccounts_IBAN",
                table: "BankAccounts",
                column: "IBAN",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BankAccounts_UserId",
                table: "BankAccounts",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Banks_SwiftCode",
                table: "Banks",
                column: "SwiftCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Beneficiaries_BankId",
                table: "Beneficiaries",
                column: "BankId");

            migrationBuilder.CreateIndex(
                name: "IX_Beneficiaries_DestinationBankAccountId",
                table: "Beneficiaries",
                column: "DestinationBankAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_Beneficiaries_UserId_FullName_MaskedAccountReference",
                table: "Beneficiaries",
                columns: new[] { "UserId", "FullName", "MaskedAccountReference" });

            migrationBuilder.CreateIndex(
                name: "IX_Merchants_Name",
                table: "Merchants",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_Merchants_SettlementBankAccountId",
                table: "Merchants",
                column: "SettlementBankAccountId");

            migrationBuilder.AddForeignKey(
                name: "FK_Transactions_BankAccounts_SourceBankAccountId",
                table: "Transactions",
                column: "SourceBankAccountId",
                principalTable: "BankAccounts",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Transactions_Beneficiaries_BeneficiaryId",
                table: "Transactions",
                column: "BeneficiaryId",
                principalTable: "Beneficiaries",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Transactions_Merchants_MerchantId",
                table: "Transactions",
                column: "MerchantId",
                principalTable: "Merchants",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Transactions_BankAccounts_SourceBankAccountId",
                table: "Transactions");

            migrationBuilder.DropForeignKey(
                name: "FK_Transactions_Beneficiaries_BeneficiaryId",
                table: "Transactions");

            migrationBuilder.DropForeignKey(
                name: "FK_Transactions_Merchants_MerchantId",
                table: "Transactions");

            migrationBuilder.DropTable(
                name: "Beneficiaries");

            migrationBuilder.DropTable(
                name: "Merchants");

            migrationBuilder.DropTable(
                name: "BankAccounts");

            migrationBuilder.DropTable(
                name: "Banks");

            migrationBuilder.DropIndex(
                name: "IX_Transactions_BeneficiaryId",
                table: "Transactions");

            migrationBuilder.DropIndex(
                name: "IX_Transactions_MerchantId",
                table: "Transactions");

            migrationBuilder.DropIndex(
                name: "IX_Transactions_SourceBankAccountId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "BeneficiaryId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "MerchantId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "SourceBankAccountId",
                table: "Transactions");
        }
    }
}
