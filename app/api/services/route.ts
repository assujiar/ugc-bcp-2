import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { apiSuccess, apiErrors } from "@/lib/api/error";

// GET /api/services - List all services from service_catalog
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return apiErrors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope"); // Filter by scope_group

    let query = supabase
      .from("service_catalog")
      .select("service_code, service_name, owner_dept, scope_group")
      .order("service_name", { ascending: true });

    if (scope) {
      query = query.eq("scope_group", scope);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching services:", error);
      return apiErrors.internal(error.message);
    }

    return apiSuccess({ data });
  } catch (error) {
    console.error("Error in GET /api/services:", error);
    return apiErrors.internal();
  }
}
