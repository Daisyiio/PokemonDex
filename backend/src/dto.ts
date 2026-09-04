import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PokemonListQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  gen?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class MoveListQueryDto extends PokemonListQueryDto {
  @IsOptional()
  @IsString()
  category?: string;
}

export class ItemListQueryDto extends PokemonListQueryDto {
  @IsOptional()
  @IsString()
  category?: string;
}

export class BreedingPlanDto {
  @IsString()
  targetId!: string;

  @IsOptional()
  moves?: string[];
}

export class BreedingSimulateDto {
  @IsString()
  targetId!: string;

  @IsOptional()
  moves?: string[];

  @IsString()
  motherId!: string;

  @IsString()
  fatherId!: string;

  @IsOptional()
  everstone?: boolean;

  @IsOptional()
  destinyKnot?: boolean;

  @IsOptional()
  @IsString()
  motherNature?: string;

  @IsOptional()
  @IsString()
  fatherNature?: string;
}

export class GeneticsPlanDto {
  @IsString()
  targetId!: string;

  @IsOptional()
  moves?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  generation?: number;
}

export class GeneticsDirectParentsDto {
  @IsString()
  targetId!: string;

  @IsOptional()
  moves?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  generation?: number;

  @IsOptional()
  includePrevGen?: boolean;
}
