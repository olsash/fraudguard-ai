using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FraudGuard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTransactionBalanceFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "NewBalanceDestination",
                table: "Transactions",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "NewBalanceOrigin",
                table: "Transactions",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OldBalanceDestination",
                table: "Transactions",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OldBalanceOrigin",
                table: "Transactions",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "Transactions",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "NewBalanceDestination", "NewBalanceOrigin", "OldBalanceDestination", "OldBalanceOrigin" },
                values: new object[] { null, null, null, null });

            migrationBuilder.UpdateData(
                table: "Transactions",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "NewBalanceDestination", "NewBalanceOrigin", "OldBalanceDestination", "OldBalanceOrigin" },
                values: new object[] { null, null, null, null });

            migrationBuilder.UpdateData(
                table: "Transactions",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "NewBalanceDestination", "NewBalanceOrigin", "OldBalanceDestination", "OldBalanceOrigin" },
                values: new object[] { null, null, null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NewBalanceDestination",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "NewBalanceOrigin",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "OldBalanceDestination",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "OldBalanceOrigin",
                table: "Transactions");
        }
    }
}
