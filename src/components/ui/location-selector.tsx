"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Import the JSON file - adjust the path/name as needed
import rwandaLocationsData from "@/data/rwanda-locations.json";

// Type for the location data structure
type VillageData = string[];
type SectorData = { [sector: string]: VillageData };
type DistrictData = { [district: string]: SectorData };
type ProvinceData = { [province: string]: DistrictData };

interface LocationSelectorProps {
  province: string;
  district: string;
  sector: string;
  village: string;
  onLocationChange: (location: {
    province: string;
    district: string;
    sector: string;
    village: string;
  }) => void;
  disabled?: boolean;
}

export function LocationSelector({
  province,
  district,
  sector,
  village,
  onLocationChange,
  disabled = false,
}: LocationSelectorProps) {
  const [selectedProvince, setSelectedProvince] = useState(province);
  const [selectedDistrict, setSelectedDistrict] = useState(district);
  const [selectedSector, setSelectedSector] = useState(sector);
  const [selectedVillage, setSelectedVillage] = useState(village);

  const rwandaLocations = rwandaLocationsData as ProvinceData;

  // Reset dependent fields when parent changes
  useEffect(() => {
    if (selectedProvince !== province) {
      setSelectedDistrict("");
      setSelectedSector("");
      setSelectedVillage("");
      onLocationChange({
        province: selectedProvince,
        district: "",
        sector: "",
        village: "",
      });
    }
  }, [selectedProvince]);

  useEffect(() => {
    if (selectedDistrict !== district) {
      setSelectedSector("");
      setSelectedVillage("");
      onLocationChange({
        province: selectedProvince,
        district: selectedDistrict,
        sector: "",
        village: "",
      });
    }
  }, [selectedDistrict]);

  useEffect(() => {
    if (selectedSector !== sector) {
      setSelectedVillage("");
      onLocationChange({
        province: selectedProvince,
        district: selectedDistrict,
        sector: selectedSector,
        village: "",
      });
    }
  }, [selectedSector]);

  useEffect(() => {
    if (selectedVillage !== village) {
      onLocationChange({
        province: selectedProvince,
        district: selectedDistrict,
        sector: selectedSector,
        village: selectedVillage,
      });
    }
  }, [selectedVillage]);

  // Safety check for rwandaLocations data
  if (!rwandaLocations || typeof rwandaLocations !== "object") {
    console.error("rwandaLocations data is not properly loaded");
    return (
      <div className="text-red-500 text-sm">
        Location data not available. Please refresh the page.
      </div>
    );
  }

  // Get provinces
  const provinces = Object.keys(rwandaLocations);

  // Get districts for selected province
  const districts =
    selectedProvince && rwandaLocations[selectedProvince]
      ? Object.keys(rwandaLocations[selectedProvince])
      : [];

  // Get sectors for selected district
  const sectors =
    selectedProvince &&
    selectedDistrict &&
    rwandaLocations[selectedProvince]?.[selectedDistrict]
      ? Object.keys(rwandaLocations[selectedProvince][selectedDistrict])
      : [];

  // Get villages for selected sector
  const villages =
    selectedProvince &&
    selectedDistrict &&
    selectedSector &&
    rwandaLocations[selectedProvince]?.[selectedDistrict]?.[selectedSector]
      ? rwandaLocations[selectedProvince][selectedDistrict][selectedSector]
      : [];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Province */}
      <div>
        <label className="text-sm font-medium block mb-1">Province</label>
        <Select
          value={selectedProvince}
          onValueChange={setSelectedProvince}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Province" />
          </SelectTrigger>
          <SelectContent>
            {provinces.map((prov) => (
              <SelectItem key={prov} value={prov}>
                {prov}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* District */}
      <div>
        <label className="text-sm font-medium block mb-1">District</label>
        <Select
          value={selectedDistrict}
          onValueChange={setSelectedDistrict}
          disabled={disabled || !selectedProvince}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select District" />
          </SelectTrigger>
          <SelectContent>
            {districts.length > 0 ? (
              districts.map((dist) => (
                <SelectItem key={dist} value={dist}>
                  {dist}
                </SelectItem>
              ))
            ) : (
              <div className="text-sm text-gray-500 p-2">
                No districts available
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Sector */}
      <div>
        <label className="text-sm font-medium block mb-1">Sector</label>
        <Select
          value={selectedSector}
          onValueChange={setSelectedSector}
          disabled={disabled || !selectedDistrict}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Sector" />
          </SelectTrigger>
          <SelectContent>
            {sectors.length > 0 ? (
              sectors.map((sec) => (
                <SelectItem key={sec} value={sec}>
                  {sec}
                </SelectItem>
              ))
            ) : (
              <div className="text-sm text-gray-500 p-2">
                No sectors available
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Village */}
      <div>
        <label className="text-sm font-medium block mb-1">Village</label>
        <Select
          value={selectedVillage}
          onValueChange={setSelectedVillage}
          disabled={disabled || !selectedSector}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Village" />
          </SelectTrigger>
          <SelectContent>
            {villages.length > 0 ? (
              villages.map((vil) => (
                <SelectItem key={vil} value={vil}>
                  {vil}
                </SelectItem>
              ))
            ) : (
              <div className="text-sm text-gray-500 p-2">
                No villages available
              </div>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
