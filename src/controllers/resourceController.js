import { ApiError } from "../utils/ApiError.js";
import { catchAsync } from "../utils/catchAsync.js";

export function createResourceController(Model, options = {}) {
  const { populate = "" } = options;

  const list = catchAsync(async (req, res) => {
    const { page = 1, limit = 20, search = "" } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Math.min(100, Number(limit)));

    const filter = {};
    if (search) {
      filter.$text = { $search: search };
    }

    const [items, total] = await Promise.all([
      Model.find(filter)
        .populate(populate)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .sort({ createdAt: -1 }),
      Model.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  });

  const getById = catchAsync(async (req, res) => {
    const item = await Model.findById(req.params.id).populate(populate);
    if (!item) {
      throw new ApiError(404, "Resource not found");
    }

    res.json({ success: true, data: item });
  });

  const create = catchAsync(async (req, res) => {
    const item = await Model.create(req.body);
    res.status(201).json({ success: true, data: item });
  });

  const update = catchAsync(async (req, res) => {
    const item = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate(populate);

    if (!item) {
      throw new ApiError(404, "Resource not found");
    }

    res.json({ success: true, data: item });
  });

  const remove = catchAsync(async (req, res) => {
    const item = await Model.findByIdAndDelete(req.params.id);
    if (!item) {
      throw new ApiError(404, "Resource not found");
    }

    res.status(204).send();
  });

  return {
    list,
    getById,
    create,
    update,
    remove
  };
}
