import "dotenv/config";

export const JWT_SECRET = process.env.JWT_SECRET || "pick_a_long_random_string_here";
