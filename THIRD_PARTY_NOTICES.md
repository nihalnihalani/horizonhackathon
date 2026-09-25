# Third-party notices

Dead Reckoning reuses code and patterns from two MIT-licensed projects. CopilotKit Intelligence is a separate hosted
service used through OpenBot's SDK; this repository's licensing does not grant any service entitlement.

| Upstream | Pinned commit | Where it lives here | What was taken |
|---|---|---|---|
| OpenBot, https://github.com/CopilotKit/openbot | `3c73cf00efba46122dfd0447485e2b61f1d6a2cd` | `apps/console/` | Exported source snapshot (see `apps/console/EXPORT.md` for the loopback patches) plus new DR files under `server/src/dead-reckoning/`, `app/src/routes/_authed/_app/missions/`, `app/src/components/dead-reckoning/`, `app/src/lib/dead-reckoning/`, `examples/dead-reckoning/` |
| OpenMuse | `f5534c77a8c8740cf792ca73b1f7737829fb7518` | `packages/task-kernel/` | Adapted `TaskContext` guard and action-approval binding concepts; mapping in `packages/task-kernel/NOTICE.md`. The OpenMuse app, SQL store, worker and scheduler are not used. |

Everything else under `packages/`, `scripts/` and `bench/` is new Dead Reckoning code.

## OpenBot license

MIT License

Copyright (c) 2026 CopilotKit

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## OpenMuse license

MIT License

Copyright (c) 2026 OpenMuse contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
