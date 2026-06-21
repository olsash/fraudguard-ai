using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FraudGuard.Api.Migrations
{
    /// <inheritdoc />
    public partial class MakeAlertTransactionOptional : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FraudAlerts_Transactions_TransactionId",
                table: "FraudAlerts");

            migrationBuilder.AlterColumn<int>(
                name: "TransactionId",
                table: "FraudAlerts",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddForeignKey(
                name: "FK_FraudAlerts_Transactions_TransactionId",
                table: "FraudAlerts",
                column: "TransactionId",
                principalTable: "Transactions",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM FraudAlerts WHERE TransactionId IS NULL");

            migrationBuilder.DropForeignKey(
                name: "FK_FraudAlerts_Transactions_TransactionId",
                table: "FraudAlerts");

            migrationBuilder.AlterColumn<int>(
                name: "TransactionId",
                table: "FraudAlerts",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_FraudAlerts_Transactions_TransactionId",
                table: "FraudAlerts",
                column: "TransactionId",
                principalTable: "Transactions",
                principalColumn: "Id");
        }
    }
}
