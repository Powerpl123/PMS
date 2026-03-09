import { catchAsync } from "../utils/catchAsync.js";
import { analyzeAssetReadings } from "../services/predictiveService.js";

export const runPrediction = catchAsync(async (req, res) => {
  const result = analyzeAssetReadings(req.body);

  res.json({
    success: true,
    data: result
  });
});
