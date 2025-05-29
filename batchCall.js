import axios from "axios";
import fs from "fs/promises";
import { PartyNameCaseModels } from "./partyNameModel.js";
import { partyNameTemp } from "./partyName.js";

const batchSize = 50;

const logToFile = async (partyName, status) => {
  const logLine = `${new Date().toISOString()} - ${partyName}: ${status}\n`;
  await fs.appendFile("tempData/partyName.txt", logLine, "utf8");
};

export const tempPartyNameDetails = async (req, res) => {
  try {
    const totalNames = partyNameTemp.length;
    const totalBatches = Math.ceil(totalNames / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = start + batchSize;
      const batchNames = partyNameTemp.slice(start, end);

      console.log(`Processing batch ${batchIndex + 1} of ${totalBatches}...`);

      for (let i = 0; i < batchNames.length; i++) {
        const partyName = batchNames[i];
        try {
          const response = await axios.post(
            process.env.NCLT_LIVE_SEARCH_PARTY_NAME_DETAILS,
            { zonalBench: "all", partyName }
          );

          if (response?.data?.cases?.length >= 1) {
            const casesWithPartyName = response.data.cases.map((caseItem) => ({
              ...caseItem,
              partyName,
            }));

            await PartyNameCaseModels.insertMany(casesWithPartyName);
            await logToFile(partyName, "success");
            console.log(partyName," __ success")
          } else {
            await logToFile(partyName, "no cases found");
          }
        } catch (err) {
          await logToFile(partyName, `error - ${err?.response?.data?.message}`);
          console.log(partyName, `error - ${err?.response?.data?.message}`);
        }
      }

      // Optional delay to avoid server rate limits
      await new Promise((resolve) => setTimeout(resolve, 5000)); // 5s delay between batches
    }

    return res.status(200).send({
      success: true,
      message: "All batches processed",
    });
  } catch (error) {
    console.error("Batch processing failed:", error.message);
    return res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};
