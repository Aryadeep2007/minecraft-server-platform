package io.github.aryadeep2007.managementbridge;

import org.bukkit.plugin.java.JavaPlugin;

import java.io.IOException;

public final class PaperManagementBridge extends JavaPlugin {

    private BridgeHttpServer bridgeServer;

    @Override
    public void onEnable() {
        bridgeServer = new BridgeHttpServer(this);

        try {
            bridgeServer.start();
            getLogger().info("Paper Management Bridge enabled.");
        } catch (IOException exception) {
            getLogger().severe(
                    "Could not start the management bridge: "
                            + exception.getMessage()
            );

            bridgeServer.stop();
            bridgeServer = null;
            getServer().getPluginManager().disablePlugin(this);
        }
    }

    @Override
    public void onDisable() {
        if (bridgeServer != null) {
            bridgeServer.stop();
            bridgeServer = null;
        }

        getLogger().info("Paper Management Bridge disabled.");
    }
}