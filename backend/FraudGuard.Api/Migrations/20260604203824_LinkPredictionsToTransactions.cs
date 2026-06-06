using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FraudGuard.Api.Migrations
{
    /// <inheritdoc />
    public partial class LinkPredictionsToTransactions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TransactionId",
                table: "Predictions",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Predictions_TransactionId",
                table: "Predictions",
                column: "TransactionId");

            migrationBuilder.AddForeignKey(
                name: "FK_Predictions_Transactions_TransactionId",
                table: "Predictions",
                column: "TransactionId",
                principalTable: "Transactions",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Predictions_Transactions_TransactionId",
                table: "Predictions");

            migrationBuilder.DropIndex(
                name: "IX_Predictions_TransactionId",
                table: "Predictions");

            migrationBuilder.DropColumn(
                name: "TransactionId",
                table: "Predictions");
        }
    }
}
