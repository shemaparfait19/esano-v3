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
  // Safety check for rwandaLocations data
  if (!rwandaLocations || typeof rwandaLocations !== 'object') {
    console.error('rwandaLocations data is not properly loaded');
    return (
      <div className="text-red-500 text-sm">
        Location data not available. Please refresh the page.
      </div>
    );
  }
  
  const provinces = Array.isArray(Object.keys(rwandaLocations)) ? Object.keys(rwandaLocations) : [];
  
  const districts = selectedProvince
    ? (() => {
        const provinceData = rwandaLocations[selectedProvince as keyof typeof rwandaLocations];
        if (provinceData && typeof provinceData === 'object') {
          const keys = Object.keys(provinceData);
          return Array.isArray(keys) ? keys : [];
        }
        return [];
      })()
    : [];
    
  const sectors =
    selectedProvince && selectedDistrict
      ? (() => {
          const provinceData = rwandaLocations[selectedProvince as keyof typeof rwandaLocations];
          if (provinceData && typeof provinceData === 'object') {
            const districtData = provinceData[selectedDistrict as keyof typeof provinceData];
            if (districtData && typeof districtData === 'object') {
              const keys = Object.keys(districtData);
              return Array.isArray(keys) ? keys : [];
            }
          }
          return [];
        })()
      : [];
      
  const villages =
    selectedProvince && selectedDistrict && selectedSector
      ? (() => {
          const provinceData = rwandaLocations[selectedProvince as keyof typeof rwandaLocations];
          if (provinceData && typeof provinceData === 'object') {
            const districtData = provinceData[selectedDistrict as keyof typeof provinceData];
            if (districtData && typeof districtData === 'object') {
              const sectorData = districtData[selectedSector as keyof typeof districtData];
              return Array.isArray(sectorData) ? sectorData : [];
            }
          }
          return [];
        })()
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
            {Array.isArray(provinces) ? provinces.map((prov) => (
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
            {Array.isArray(districts) ? districts.map((dist) => (
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
            {Array.isArray(sectors) ? sectors.map((sec) => (
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
            {Array.isArray(villages) ? villages.map((vil) => (
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
