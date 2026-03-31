import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schemas";

const connectionString = process.env.DATABASE_POOL_URL!;

const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
