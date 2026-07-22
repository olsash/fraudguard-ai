using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FraudGuard.Api.Migrations
{
    /// <inheritdoc />
    public partial class StrengthenDemoBankAccountVerificationHashes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 1,
                column: "VerificationCodeHash",
                value: "F724A30965E1FBA1EA7CA65F0B0D600572D0D61081053F7C0483DBC66F569C32");

            migrationBuilder.UpdateData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 2,
                column: "VerificationCodeHash",
                value: "518810C012FE56C8C0A4BEE3E081CE803696900FB1FA4935AD975E82D0729359");

            migrationBuilder.UpdateData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 3,
                column: "VerificationCodeHash",
                value: "B79E8098800EAD554EB209EAC3A33A424CDF3D74C97C856E12F1D14788FC070E");

            migrationBuilder.UpdateData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 4,
                column: "VerificationCodeHash",
                value: "35EE79ED144A5EA1651070092B24490BD6B1E860770014AB785EDE76BEE3FD6F");

            migrationBuilder.UpdateData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 5,
                column: "VerificationCodeHash",
                value: "7C12876906BF253B6FE18C413F6D7EC3B0005280ADB98C549B92BB6AFFFF2CAB");

            migrationBuilder.UpdateData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 6,
                column: "VerificationCodeHash",
                value: "68012CE7110B4F58E50F7605C9AE08C04759B8EF9CE45A30DAF4C7B438B673DE");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 1,
                column: "VerificationCodeHash",
                value: "3C42482F6E55E0AE0D7AC677470207609DD82F6C9427236AD1CE6AD01169C2C0");

            migrationBuilder.UpdateData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 2,
                column: "VerificationCodeHash",
                value: "883B3DC1D5E43A37C72D6135BFD60D022299844D82DF4EB6B92A795CB9C6EA6D");

            migrationBuilder.UpdateData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 3,
                column: "VerificationCodeHash",
                value: "2F89629F0EA3F530A487C1A87B205F859D886A08CFEAB7D4228D3762767D705B");

            migrationBuilder.UpdateData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 4,
                column: "VerificationCodeHash",
                value: "AAF87529516EB6F4FE3874236DB5AC9D80B77335442ECD5B63058B8102D905B1");

            migrationBuilder.UpdateData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 5,
                column: "VerificationCodeHash",
                value: "E2AF2C7BE4BBD46FBEB0E4EFC1168E1E38CF58BC7274E836AE545E12963DB8C8");

            migrationBuilder.UpdateData(
                table: "DemoBankAccounts",
                keyColumn: "Id",
                keyValue: 6,
                column: "VerificationCodeHash",
                value: "1FA8D8C467FBEE252AE084414E3FD6271F1F391D19CFFAB0D78CCBC20F7404A7");
        }
    }
}
