using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FraudGuard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDevelopmentSimulatedAccountOwnership : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DevelopmentUserId",
                table: "DemoBankAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 1,
                column: "DevelopmentUserId",
                value: null);

            migrationBuilder.UpdateData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 2,
                column: "DevelopmentUserId",
                value: null);

            migrationBuilder.UpdateData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 3,
                column: "DevelopmentUserId",
                value: null);

            migrationBuilder.UpdateData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 4,
                column: "DevelopmentUserId",
                value: null);

            migrationBuilder.UpdateData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 5,
                column: "DevelopmentUserId",
                value: null);

            migrationBuilder.UpdateData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 6,
                column: "DevelopmentUserId",
                value: null);

            migrationBuilder.UpdateData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 7,
                column: "DevelopmentUserId",
                value: null);

            migrationBuilder.CreateIndex(
                name: "IX_DemoBankAccounts_DevelopmentUserId",
                table: "DemoBankAccounts",
                column: "DevelopmentUserId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoBankAccounts_DevelopmentUserId_BankId",
                table: "DemoBankAccounts",
                columns: new[] { "DevelopmentUserId", "BankId" },
                unique: true,
                filter: "[DevelopmentUserId] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_DemoBankAccounts_Users_DevelopmentUserId",
                table: "DemoBankAccounts",
                column: "DevelopmentUserId",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DemoBankAccounts_Users_DevelopmentUserId",
                table: "DemoBankAccounts");

            migrationBuilder.DropIndex(
                name: "IX_DemoBankAccounts_DevelopmentUserId",
                table: "DemoBankAccounts");

            migrationBuilder.DropIndex(
                name: "IX_DemoBankAccounts_DevelopmentUserId_BankId",
                table: "DemoBankAccounts");

            migrationBuilder.DropColumn(
                name: "DevelopmentUserId",
                table: "DemoBankAccounts");
        }
    }
}
