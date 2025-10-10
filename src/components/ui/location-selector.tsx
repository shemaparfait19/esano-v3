"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import rwandaLocations from "@/data/rwanda-locations.json.json";

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

  // Get available options based on current selections
  const provinces = Object.keys(rwandaLocations);
  const districts = selectedProvince
    ? Object.keys(
        rwandaLocations[selectedProvince as keyof typeof rwandaLocations] || {}
      )
    : [];
  const sectors =
    selectedProvince && selectedDistrict
      ? Object.keys(
          rwandaLocations[selectedProvince as keyof typeof rwandaLocations]?.[
            selectedDistrict as keyof (typeof rwandaLocations)[typeof selectedProvince]
          ] || {}
        )
      : [];
  const villages =
    selectedProvince && selectedDistrict && selectedSector
      ? rwandaLocations[selectedProvince as keyof typeof rwandaLocations]?.[
          selectedDistrict as keyof (typeof rwandaLocations)[typeof selectedProvince]
        ]?.[
          selectedSector as keyof (typeof rwandaLocations)[typeof selectedProvince][typeof selectedDistrict]
        ] || []
      : [];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Province */}
      <div>
        <label className="text-sm font-medium">Province</label>
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
        <label className="text-sm font-medium">District</label>
        <Select
          value={selectedDistrict}
          onValueChange={setSelectedDistrict}
          disabled={disabled || !selectedProvince}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select District" />
          </SelectTrigger>
          <SelectContent>
            {districts.map((dist) => (
              <SelectItem key={dist} value={dist}>
                {dist}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sector */}
      <div>
        <label className="text-sm font-medium">Sector</label>
        <Select
          value={selectedSector}
          onValueChange={setSelectedSector}
          disabled={disabled || !selectedDistrict}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Sector" />
          </SelectTrigger>
          <SelectContent>
            {sectors.map((sec) => (
              <SelectItem key={sec} value={sec}>
                {sec}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Village */}
      <div>
        <label className="text-sm font-medium">Village</label>
        <Select
          value={selectedVillage}
          onValueChange={setSelectedVillage}
          disabled={disabled || !selectedSector}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Village" />
          </SelectTrigger>
          <SelectContent>
            {villages.map((vil) => (
              <SelectItem key={vil} value={vil}>
                {vil}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
