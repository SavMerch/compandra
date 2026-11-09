import { brand } from '@/config/brand';
import { cn } from '@/lib/utils';
/** multiply blends the logo's white background into the page color. */
export const CompanyLogo = ({ className }: { className?: string }) => <img src={brand.companyLogo} alt={brand.companyName} className={cn('h-auto w-36 mix-blend-multiply', className)} />;
