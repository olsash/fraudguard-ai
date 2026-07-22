using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FraudGuard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFraudCaseNotesAndReviewMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ReviewStartedAt",
                table: "FraudCases",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "FraudCases",
                type: "rowversion",
                rowVersion: true,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "FraudCaseNotes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FraudCaseId = table.Column<int>(type: "int", nullable: false),
                    AnalystId = table.Column<int>(type: "int", nullable: false),
                    Comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FraudCaseNotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FraudCaseNotes_FraudCases_FraudCaseId",
                        column: x => x.FraudCaseId,
                        principalTable: "FraudCases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FraudCaseNotes_Users_AnalystId",
                        column: x => x.AnalystId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_FraudCaseNotes_AnalystId",
                table: "FraudCaseNotes",
                column: "AnalystId");

            migrationBuilder.CreateIndex(
                name: "IX_FraudCaseNotes_CreatedAt",
                table: "FraudCaseNotes",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_FraudCaseNotes_FraudCaseId",
                table: "FraudCaseNotes",
                column: "FraudCaseId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FraudCaseNotes");

            migrationBuilder.DropColumn(
                name: "ReviewStartedAt",
                table: "FraudCases");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "FraudCases");
        }
    }
}
