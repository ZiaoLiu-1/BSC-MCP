@echo off
echo Setting up Cursor MCP configuration...
echo { "configFile": "%CD%\\cursor-mcp-config.json" } > "%USERPROFILE%\.cursor\mcp.json"
echo Configuration completed successfully!
echo Restart Cursor to apply changes. 