// Combat feel hooks: called by the player and enemy code at key moments, implemented here with
// visual effects, sounds and camera feedback. Keep these signatures stable.
//  swingFx(P, atk)            the player starts a melee swing (atk.kind 'light'|'heavy', atk.wt weapon type, atk.pose)
//  swingPeakFx(P, atk)        the swing reaches its hit moment (whether or not it hit)
//  hitFx(e, dmg, crit, kind, src)  an enemy was damaged; kind 'light'|'heavy'|'ability'|'spell'; src {x,y,z} of the blow
//  blockFx(P, src)            the player blocked a hit
//  hurtFx(P, dmg, src)        the player took damage
//  dodgeFx(P)                 the player starts a dodge
//  killFx(e)                  an enemy died
//  castFx(P, el)              the player casts a spell of element el
export function swingFx(P, atk) {}
export function swingPeakFx(P, atk) {}
export function hitFx(e, dmg, crit, kind, src) {}
export function blockFx(P, src) {}
export function hurtFx(P, dmg, src) {}
export function dodgeFx(P) {}
export function killFx(e) {}
export function castFx(P, el) {}
