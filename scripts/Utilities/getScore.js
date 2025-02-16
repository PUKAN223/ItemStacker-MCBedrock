import { world } from "@minecraft/server";
export function getScore(pl, obj) {
    let objectives = world.scoreboard.getObjective(obj);
    if (objectives) {
        return objectives.getScore(pl);
    }
    return 0;
}
