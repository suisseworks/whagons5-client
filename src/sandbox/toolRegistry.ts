import { z } from 'zod';

export const AddUserParamsSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
});

export type AddUserParams = z.infer<typeof AddUserParamsSchema>;

export type SandboxToolDef = {
  /** The method name the sandbox calls (api.<method>) */
  method: 'addUser';
  description: string;
  paramsSchema: z.ZodTypeAny;
  resultExample: unknown;
};

export const sandboxTools: SandboxToolDef[] = [
  {
    method: 'addUser',
    description:
      'Create a new user. Currently stubbed: logs on main thread and returns a mock success payload.',
    paramsSchema: AddUserParamsSchema,
    resultExample: {
      ok: true,
      userId: 'usr_mock_1700000000000',
      email: 'a@b.com',
      name: 'Ada',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  },
];

/**
 * Tool definition text you can embed in an agent prompt to describe what sandboxed JS may call.
 * This intentionally describes ONLY the `api.*` surface (not DOM/network/etc).
 */
export function getSandboxToolDefinitionText(): string {
  return [
    'Sandboxed JavaScript runs in QuickJS (WASM) inside a Web Worker.',
    'It cannot access DOM, network, localStorage/cookies, or your app JS realm.',
    '',
    'Available capabilities (only these are callable):',
    '- api.addUser({ email: string, name?: string }): Promise<{ ok: true, userId: string, email: string, name: string|null, createdAt: string }>',
    '',
    'Example:',
    'const r = await api.addUser({ email: "a@b.com", name: "Ada" });',
    'return r;',
  ].join('\n');
}

