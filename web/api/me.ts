import { readMe } from '../server/contracts.ts';
import { ok } from '../server/errors.ts';
import { withApi } from '../server/http.ts';
import { requireSession } from '../server/session.ts';

export const GET = withApi(async (request) => ok(await readMe(requireSession(request))));
