const bool = (k: string): boolean => import.meta.env[k] === '1';

export const FLAGS = {
    community: bool('VITE_FLAG_COMMUNITY'),
    war: bool('VITE_FLAG_WAR'),
    redeem: bool('VITE_FLAG_REDEEM'),
    transfer: bool('VITE_FLAG_TRANSFER'),
    devLogin: bool('VITE_FLAG_DEV_LOGIN'),
};
