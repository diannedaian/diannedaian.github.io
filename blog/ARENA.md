# Browser arena

The blog's `/play/` link points to a static package of the existing emoji duel.
It uses validation-selected model A, not a retrained or modified checkpoint.

Rebuild from the local SAP RL repository:

```sh
node scripts/package-arena.mjs /path/to/sap-rl-lab
```

The packaging step checks the frozen model/rule hashes before copying them.
The page title, navigation, canonical URL, disclaimer and English
presentation labels are adapted. `scripts/arena-english.mjs` translates UI text
at packaging time, plus runtime-generated decision labels and the opening battle
message at display time. Python rule code and model arrays are not changed.
No private replay collection, optimizer, credentials, training logs or server-side
inference is needed. First launch fetches Pyodide and NumPy from jsDelivr;
subsequent gameplay runs in a browser worker. This is a direct duel, not the
asynchronous Arena evaluation used for the published success rates.

## Hosting

The arena is packaged for GitHub Pages at https://diannedaian.github.io/play/.
Deploy it with the website's normal main-branch publication. No inference server
or secret is required. Article links are relative, so the same files work both
in a local preview and on the public website. After deploying, verify loading,
buying, battle playback and the next round on the public host.

Local verification on 2026-09-28 passed: worker initialization and built-in
model parity checks, buying Fish (10 → 7 gold), a real model battle, and starting
round 2 with the pet retained and gold reset to 10. Asset hashes matched the
frozen export. Controls, instructions, loading/error messages, ability labels,
decisions and playback labels now have an English presentation layer.

Run the presentation/asset regression checks with:

```sh
node --test scripts/arena-english.test.mjs
```
