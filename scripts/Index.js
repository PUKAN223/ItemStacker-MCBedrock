import { MinecraftDimensionTypes, system, world } from "@minecraft/server";
//System
import "./Systems/ItemStackers";

import { itemStackMap } from "./Systems/ItemStackers";
//Cancel Watchdog
system.beforeEvents.watchdogTerminate.subscribe((ev) => {
    ev.cancel = true;
});
//Reset Item
system.afterEvents.scriptEventReceive.subscribe((ev) => {
    let count = 0;
    if (ev.id == "item:clear") {
        itemStackMap.clear();
        Object.keys(MinecraftDimensionTypes).forEach(dim => {
            world.getDimension(MinecraftDimensionTypes[dim]).getEntities({ type: "minecraft:item" }).forEach(en => {
                en.addTag("itemStacks");
                en.remove();
                count++;
            });
        });
        world.sendMessage("Item Cleared: " + count + "x");
    }
});
