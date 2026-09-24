;
for(const [key,canonical]of Object.entries(PAYLOAD.assetAliases))PAYLOAD.assets[key]=PAYLOAD.assets[canonical];
