const {execFileSync}=require('node:child_process');
for(const file of ['check-fonts.cjs','check-typography.cjs','check-nexus-frames.cjs','check-frame-colors.cjs','check-prototype.cjs','check-layouts.cjs','check-editor.cjs','check-edge-cases.cjs','check-remote-artwork.cjs'])execFileSync(process.execPath,['scripts/'+file],{stdio:'inherit',env:process.env});
