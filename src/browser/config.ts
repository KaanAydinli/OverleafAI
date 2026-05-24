import * as path from "path";

export const config = {
  sessionsDir: path.resolve(process.env.SESSIONS_DIR ?? "./sessions"),
};
