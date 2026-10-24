import { erc1155Abi, isAddress, zeroAddress, type Abi } from 'viem';
import gameAbi from './abi/MonsGame.json';
import partsAbi from './abi/MonsParts.json';
import communityAbi from './abi/MonsCommunity.json';
import type { Hex } from './types.ts';

const env = import.meta.env;
const addr = (v: string | undefined): Hex => (v && isAddress(v) ? (v as Hex) : zeroAddress);

export const ADDR = {
    game: addr(env.VITE_GAME_ADDRESS),
    parts: addr(env.VITE_PARTS_ADDRESS),
    community: addr(env.VITE_COMMUNITY_ADDRESS),
} as const;

export const DEPLOY_BLOCK: bigint = BigInt(env.VITE_DEPLOY_BLOCK || 0);

export const GAME = { address: ADDR.game, abi: gameAbi as Abi } as const;
// Interface ABI may omit inherited ERC1155 functions (balanceOfBatch), so merge the standard one in.
export const PARTS = { address: ADDR.parts, abi: [...(partsAbi as Abi), ...erc1155Abi] as Abi } as const;
export const COMMUNITY = { address: ADDR.community, abi: communityAbi as Abi } as const;
