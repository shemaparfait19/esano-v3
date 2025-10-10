"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Import your JSON file - make sure the path matches your file exactly
import rwandaLocationsData from "@/data/rwanda-locations.json";

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

  // Cast to any to avoid TypeScript issues
  const rwandaLocations = rwandaLocationsData as any;

  // Update parent when province changes
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

  // Update parent when district changes
  useEffect(() => {
    console.log("District useEffect triggered:", {
      selectedDistrict,
      district,
    });
    if (selectedDistrict !== district) {
      console.log("Calling onLocationChange with district:", selectedDistrict);
      setSelectedSector("");
      setSelectedVillage("");
      onLocationChange({
        province: selectedProvince,
        district: selectedDistrict,
        sector: "",
        village: "",
      });
    }
  }, [selectedDistrict, district, selectedProvince, onLocationChange]);

  // Update parent when sector changes
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

  // Update parent when village changes
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

  // Get provinces
  const provinces = rwandaLocations ? Object.keys(rwandaLocations) : [];

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
  const villagesRaw =
    selectedProvince &&
    selectedDistrict &&
    selectedSector &&
    rwandaLocations[selectedProvince]?.[selectedDistrict]?.[selectedSector]
      ? rwandaLocations[selectedProvince][selectedDistrict][selectedSector]
      : [];

  // Ensure villages is always an array
  const villages = Array.isArray(villagesRaw) ? villagesRaw : [];

  // Debug log to see what we're getting
  console.log("=== LocationSelector Debug ===");
  console.log("Province:", selectedProvince);
  console.log("District:", selectedDistrict);
  console.log("Sector:", selectedSector);
  console.log("Villages Raw:", villagesRaw);
  console.log("Villages Raw type:", typeof villagesRaw);
  console.log("Villages Raw isArray:", Array.isArray(villagesRaw));
  console.log("Villages:", villages);
  console.log("Villages type:", typeof villages);
  console.log("Villages isArray:", Array.isArray(villages));
  console.log("Villages length:", villages?.length);
  console.log("Villages keys:", villages ? Object.keys(villages) : null);
  console.log("Sectors:", sectors);
  console.log("Sectors length:", sectors?.length);
  console.log(
    "Province data:",
    selectedProvince ? rwandaLocations[selectedProvince] : null
  );
  console.log(
    "District data:",
    selectedProvince && selectedDistrict
      ? rwandaLocations[selectedProvince]?.[selectedDistrict]
      : null
  );
  console.log(
    "Test path:",
    selectedProvince && selectedDistrict && selectedSector
      ? rwandaLocations[selectedProvince]?.[selectedDistrict]?.[selectedSector]
      : null
  );
  console.log("=== End Debug ===");

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
          onValueChange={(value) => {
            console.log("District selected:", value);
            setSelectedDistrict(value);
          }}
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
                {selectedProvince
                  ? "No districts available"
                  : "Select a province first"}
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
                {selectedDistrict
                  ? "No sectors available"
                  : "Select a district first"}
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
            {Array.isArray(villages) && villages.length > 0 ? (
              villages.map((vil) => (
                <SelectItem key={vil} value={vil}>
                  {vil}
                </SelectItem>
              ))
            ) : (
              <div className="text-sm text-gray-500 p-2">
                {selectedSector
                  ? "No villages available"
                  : "Select a sector first"}
              </div>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
