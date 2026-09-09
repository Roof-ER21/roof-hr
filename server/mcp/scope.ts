/**
 * The one string the whole read-only design hangs on. Kept dependency-free so
 * the tool registry (and its unit tests) can import it without opening a pool.
 *
 * A session row whose `agent_scope` equals this value is a loopback session an
 * MCP tool acts through: never sliding-renewed, refused on any non-GET/HEAD
 * request (server/middleware/auth.ts, server/routes.ts).
 */
export const MCP_READ_SCOPE = 'mcp:read';
