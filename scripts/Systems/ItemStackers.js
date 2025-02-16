import { ItemStack, MinecraftDimensionTypes, system, world } from "@minecraft/server";
import DynamicProperties from "Utilities/Database";
//Storages
export const itemStackMap = new DynamicProperties("itemStack");
//Events
world.beforeEvents.entityRemove.subscribe((ev) => {
    const { removedEntity } = ev;
    if (isRealItems(removedEntity)) {
        const removedItem = itemStackMap.get(removedEntity.id);
        const removedDimension = removedEntity.dimension.id;
        const removedLocation = JSON.stringify(removedEntity.location);
        system.run(() => {
            removedItem.itemStack.amount, removedItem.realAmount, removedItem.itemStack.maxAmount;
            const size = getSizeStack(removedItem.itemStack.amount, removedItem.realAmount, removedItem.itemStack.maxAmount);
            for (let i = 0; i < size.length; i++) {
                const items = removedItem.itemStack;
                items.amount = size[i];
                const itemSpawn = world.getDimension(removedDimension).spawnItem(JsonToItem(items), JSON.parse(removedLocation));
                itemSpawn.addTag("itemStacks");
                system.runTimeout(() => {
                    if (itemSpawn.isValid()) {
                        const itemSpawnDimension = itemSpawn.dimension.id;
                        const itemSpawnLocation = JSON.stringify(itemSpawn.location);
                        const itemSpawnItem = itemSpawn.getComponent("item").itemStack;
                        itemSpawn.remove();
                        world.getDimension(itemSpawnDimension).spawnItem(itemSpawnItem, JSON.parse(itemSpawnLocation));
                    }
                }, 20);
            }
            itemStackMap.delete(removedEntity.id);
        });
    }
});
world.afterEvents.entitySpawn.subscribe((ev) => {
    const { entity: addedEntity } = ev;
    if (isRealItems(ev.entity)) {
        CombineItems(addedEntity);
        itemStackMap.set(addedEntity.id, { itemStack: ItemToJson(addedEntity.getComponent("item").itemStack), realAmount: getItemAmount(addedEntity) });
    }
});
//Functions
function isRealItems(entity) {
    return entity.typeId == "minecraft:item" && !entity.hasTag("itemStacks");
}
function getSizeStack(current, amount, maxStack) {
    const remaining = amount - current;
    return [...Array(Math.floor(remaining / maxStack)).fill(maxStack), remaining % maxStack].filter(Boolean);
}
function ItemToJson(item) {
    let itemDynamic = [];
    let itemDurability = 0;
    let itemEnchantment = [];
    if (item.getDynamicPropertyIds().length !== 0) {
        item.getDynamicPropertyIds().forEach(ids => {
            itemDynamic.push({ id: ids, data: item.getDynamicProperty(ids) });
        });
    }
    if (item.getComponent("durability") && item.getComponent("durability").damage !== 0) {
        itemDurability = item.getComponent("durability").damage;
    }
    if (item.getComponent("enchantable") && item.getComponent("enchantable").getEnchantments().length !== 0) {
        itemEnchantment = item.getComponent("enchantable").getEnchantments();
    }
    const data = {
        typeId: item.typeId,
        amount: item.amount,
        keepOnDeath: item.keepOnDeath,
        lockMode: item.lockMode,
        maxAmount: item.maxAmount,
        nameTag: item.nameTag,
        dynamicProperty: itemDynamic ?? undefined,
        lores: item.getLore(),
        can_destroy: item.getCanDestroy(),
        can_placeon: item.getCanPlaceOn(),
        durability: itemDurability,
        enchants: itemEnchantment ?? []
    };
    return data;
}
function JsonToItem(itemJson) {
    let items = new ItemStack(itemJson.typeId, itemJson.amount);
    items.setCanDestroy(itemJson.can_destroy);
    items.setCanPlaceOn(itemJson.can_placeon);
    if (itemJson.durability) {
        items.getComponent("durability").damage = itemJson.durability;
    }
    itemJson.dynamicProperty.forEach(({ id, data }) => {
        items.setDynamicProperty(id, data);
    });
    if (itemJson.enchants) {
        itemJson.enchants.forEach(enc => {
            items.getComponent("enchantable").addEnchantment({ type: enc.type, level: enc.level });
        });
    }
    items.keepOnDeath = itemJson.keepOnDeath;
    items.lockMode = itemJson.lockMode;
    items.setLore(itemJson.lores);
    items.nameTag = itemJson.nameTag;
    return items;
}
function CombineItems(entity) {
    if (isRealItems(entity)) {
        const itemNearBy = getItemNearBy(entity, 10);
        const tagFound = entity.getTags().find(x => x.startsWith("cout:"));
        if (tagFound) {
            entity.removeTag(tagFound);
            entity.addTag(`cout:${itemNearBy.reduce((prev, crr) => prev + getItemAmount(crr), 0) + entity.getComponent("item").itemStack.amount}`);
        }
        else {
            entity.addTag(`cout:${itemNearBy.reduce((prev, crr) => prev + getItemAmount(crr), 0) + entity.getComponent("item").itemStack.amount}`);
        }
        itemNearBy.forEach(en => {
            en.addTag("itemStacks");
            itemStackMap.delete(en.id);
            en.remove();
        });
    }
}
function getItemAmount(entity) {
    return parseInt(entity.getTags().find(x => x.startsWith("cout:")).split(":")[1]) ?? entity.getComponent("item").itemStack.amount;
}
const DisabledItem = ["minecraft:bundle", "shulker_box"];
function getItemNearBy(entity, distance) {
    const itemNearBy = entity.dimension.getEntities({ type: "minecraft:item", excludeTags: ["itemStacks"], location: entity.location, maxDistance: distance })
        .filter(x => x !== entity)
        .filter(x => x.getComponent("item").itemStack.typeId == entity.getComponent("item").itemStack.typeId)
        .filter(x => !x.getComponent("item").itemStack.getComponent("enchantable"))
        .filter(x => x.getTags().some(x => x.startsWith("cout:")))
        .filter(x => !DisabledItem.some(e => x.getComponent("item").itemStack.typeId.includes(e)));
    return itemNearBy;
}
function ItemsToName(entity) {
    return entity.getComponent("item").itemStack.typeId
        .split(":")[1]
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}
const SeeingItem = new Set();
system.runInterval(() => {
    SeeingItem.clear();
    world.getAllPlayers().forEach(pl => {
        pl.dimension.getEntities({ type: "minecraft:item", excludeTags: ["itemStacks"], location: pl.location, maxDistance: 15 }).forEach(en => {
            SeeingItem.add(en);
        });
    });
    Object.keys(MinecraftDimensionTypes).forEach(dim => {
        world.getDimension(MinecraftDimensionTypes[dim]).getEntities({ type: "minecraft:item", excludeTags: ["itemStacks"] }).filter(x => x.getTags().some(x => x.startsWith("cout:"))).forEach(en => {
            if (!SeeingItem.has(en)) {
                en.nameTag = "";
            }
            else {
                en.nameTag = `§e>> §c${getItemAmount(en)}§7x§r §7${ItemsToName(en)}`;
            }
        });
    });
}, 5);
