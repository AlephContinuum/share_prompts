import { Schema, model, models } from "mongoose";

const PromptSchema = new Schema(
  {
    creator: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    prompt: {
      type: String,
      required: [true, "Prompt is required."],
      maxlength: [4000, "Prompt must be 4000 characters or fewer."],
    },
    tag: {
      type: String,
      required: [true, "Tag is required."],
    },
    // Users who liked this prompt. Stored as ids so a user can only like once.
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    // How many times the prompt has been run in the playground.
    runCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

PromptSchema.index({ createdAt: -1 });

const Prompt = models.Prompt || model("Prompt", PromptSchema);

export default Prompt;
