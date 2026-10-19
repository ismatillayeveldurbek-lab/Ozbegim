import { handle, json } from "@/lib/server/http";
import { servicesStatus } from "@/lib/server/services";

export const GET = handle(async () => json(servicesStatus()));
