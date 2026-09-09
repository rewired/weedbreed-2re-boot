# Weed Breed — Legacy archive manifest

Archive created: 2026-09-09
Archive location: `D:\__DEV\weedbreed-legacy-archive-2026-09-09`

`weedbreed-2re-boot` is the only active project and is not part of this archive.

## Archive policy

Each legacy project is preserved as a source ZIP containing its current working
tree, including uncommitted and untracked source files. Existing Git repositories
also have an independently verified `git bundle --all` containing every local
ref and commit.

The source ZIPs intentionally exclude reconstructible or runtime-only material:
Git metadata, `node_modules`, package caches, build output, coverage output,
Python virtual environments and bytecode, test reports, runtime logs, Codex
binaries/databases/caches, and comparable generated directories.

The unique Codex `sessions`, `archived_sessions`, and `history.jsonl` found under
`weedbreed-flow` are retained separately in
`weedbreed-flow-codex-sessions.zip`. They are not mixed into the source archive.

## Preserved projects

| Project | Original size | Source ZIP | Git history |
|---|---:|---:|---:|
| `weedbreed-flow` | 1,205.24 MiB | 0.16 MiB | 0.18 MiB |
| `weedbreed-factory` | 158.44 MiB | 0.14 MiB | 0.17 MiB |
| `weedbreed-rereboot` | 0.15 MiB | 0.04 MiB | 0.04 MiB |
| `weebbreed-reboot` | 440.37 MiB | 3.23 MiB | 4.62 MiB |
| `weebbreed-reboot-backup` | 0.22 MiB | 0.19 MiB | — |
| `weed-breed-ai` | 79.13 MiB | 0.19 MiB | 0.39 MiB |
| `weed-breed-docs` | 0.23 MiB | 0.11 MiB | — |
| `weed-breed-js` | 142.35 MiB | 2.57 MiB | 3.00 MiB |
| `wbzwo` | 6.28 MiB | 2.55 MiB | — |
| `weed-breed-ui` | 146.95 MiB | 0.10 MiB | 0.04 MiB |
| `weed-breed-js-zwo` | 15.41 MiB | 0.09 MiB | 0.34 MiB |

The separate Codex session archive is 89.76 MiB. Total retained archive size
before adding this manifest is 107.91 MiB.

## SHA-256 checksums

```text
AF53033C470442729E01DDE8790B993203FE1F034CC6D3FE2871EB9B6C32DD87  wbzwo-source.zip
29D4966A37F1198B7CAEE98445751F4D9D37A510294FD5FE51BB5C0EC6E675AF  weebbreed-reboot-backup-source.zip
FED3536D1AD936AEC0427D07A4089F6348087C04957F56AB4A29E128E3C5C91E  weebbreed-reboot-history.bundle
18DD53B7966BCB4A4DC067E8DBD03177F5D12E1102A9315EAC7473407ED49CD2  weebbreed-reboot-source.zip
228E0EE17C41C0626A4938FBBD9355A34112308B59F61BB457DBCC20CDC8BA9B  weed-breed-ai-history.bundle
4D66DF8BC8D701379866FA1DD86B8F96D1BFCABE45BA58D2ACB061A7625FD4E0  weed-breed-ai-source.zip
FBF9375ED7D1D27E9CBD10EAE2247E6B2449239415CA0FFC07A25C0DA6A2E6AA  weed-breed-docs-source.zip
DB31E863AC189459A027A0E676E89CB0EE677DF774DD118C302AD1E113C4F3A3  weed-breed-js-history.bundle
EB444BF27B4AE26D9BD5C56C0320857B6B4B896C29E314E16FEF21D72F37BA29  weed-breed-js-source.zip
515730CF9907909AD8F6D9419AC772641877E8E40BC50D0BA67620A6B20AF2CB  weed-breed-js-zwo-history.bundle
922906DFA3670C1B038201045E0E3CCA951EDD44F1DD55356275FE9ACAE9CBBC  weed-breed-js-zwo-source.zip
61BCCAA6F014F6E009BA80C7CD7987324368F07B7B6104BDE14868F9CE7E5E9C  weed-breed-ui-history.bundle
7C63B2307AC09972A2969053A2ACD3A196083C6416DEAC2247CCDCBC7AF0144A  weed-breed-ui-source.zip
468DCC31790175E93FA4EFEF3C44E0634A85381A6B4EB1130BEC3067199CA29D  weedbreed-factory-history.bundle
1A9E46DD74F214EA9AF61D8D851856CFAD16F3ACEB047EEB989F54D54F281BA7  weedbreed-factory-source.zip
294FC4B1AA7C7465A16BF949F8CC8BAA3E33D85A76F3E53DBCC5867B159C3473  weedbreed-flow-codex-sessions.zip
BE8616B9FFD38E765362D8516580EF6F1299076E69913A2ECBF50193DEF15126  weedbreed-flow-history.bundle
12717AC80820383A186DC8B3C78A42FE8D60336D5C971347B66D1E46717ED6F2  weedbreed-flow-source.zip
AB462F19A7518A1FA9ABB9EFD5D795390DA3909489EFEF69D81B7103B018C664  weedbreed-rereboot-history.bundle
3D2580E346AAF1AAE341FEC91CD54CD8D1B72F8FC9C54C966C7B7A19F416029A  weedbreed-rereboot-source.zip
```

Every ZIP was successfully enumerated and checked for excluded directory
classes. Every Git bundle passed `git bundle verify` before deletion of an
original project directory.

## Restoration

For a non-Git project, extract its source ZIP. For a Git project, clone the
corresponding history bundle first, then overlay the matching source ZIP to
restore the archived working tree and its uncommitted files. Install dependencies
again from the preserved lockfiles.
