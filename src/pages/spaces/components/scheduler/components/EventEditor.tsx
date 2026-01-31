import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SchedulerEvent, SchedulerResource } from "../types/scheduler";
import {
  combineLocalDateAndTime,
  formatLocalDateInput,
  formatLocalTimeInput,
  snapDateToInterval,
} from "../utils/dateTime";

interface EventEditorProps {
  event: SchedulerEvent | null;
  resources: SchedulerResource[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: {
    name: string;
    startDate: Date;
    endDate: Date;
    resourceIds: number[];
    description?: string;
  }) => Promise<void>;
  mode: "create" | "edit";
  createEventData?: { date: Date; resourceIndex: number } | null;
}

export default function EventEditor({
  event,
  resources,
  isOpen,
  onClose,
  onSave,
  mode,
  createEventData,
}: EventEditorProps) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedResourceIds, setSelectedResourceIds] = useState<number[]>([]);
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (event && mode === "edit") {
      setName(event.name);
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);
      setStartDate(formatLocalDateInput(start));
      setStartTime(formatLocalTimeInput(start));
      setEndDate(formatLocalDateInput(end));
      setEndTime(formatLocalTimeInput(end));
      setSelectedResourceIds([event.resourceId]);
    } else if (mode === "create") {
      if (createEventData) {
        // Use clicked position for new event
        const start = new Date(createEventData.date);
        const snappedStart = snapDateToInterval(start, 15 * 60 * 1000);
        
        const end = new Date(snappedStart);
        end.setHours(end.getHours() + 1); // Default 1 hour duration
        
        setStartDate(formatLocalDateInput(snappedStart));
        setStartTime(formatLocalTimeInput(snappedStart));
        setEndDate(formatLocalDateInput(end));
        setEndTime(formatLocalTimeInput(end));
        setSelectedResourceIds([resources[createEventData.resourceIndex]?.id].filter(Boolean) as number[]);
      } else {
        // Default to today, 9 AM - 10 AM
        const now = new Date();
        setStartDate(formatLocalDateInput(now));
        setStartTime("09:00");
        setEndDate(formatLocalDateInput(now));
        setEndTime("10:00");
        setSelectedResourceIds([]);
      }
      setName("");
      setDescription("");
    }
  }, [event, mode, isOpen, createEventData, resources]);

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Please enter a task name");
      return;
    }

    if (selectedResourceIds.length === 0) {
      alert("Please select at least one resource");
      return;
    }

    setIsSaving(true);
    try {
      const start = combineLocalDateAndTime(startDate, startTime);
      const end = combineLocalDateAndTime(endDate, endTime);

      if (end <= start) {
        alert("End date/time must be after start date/time");
        setIsSaving(false);
        return;
      }

      await onSave({
        name: name.trim(),
        startDate: start,
        endDate: end,
        resourceIds: selectedResourceIds,
        description: description.trim() || undefined,
      });

      onClose();
    } catch (error) {
      console.error("Failed to save event:", error);
      alert("Failed to save event. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleResource = (resourceId: number) => {
    setSelectedResourceIds((prev) =>
      prev.includes(resourceId)
        ? prev.filter((id) => id !== resourceId)
        : [...prev, resourceId]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create New Task" : "Edit Task"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Task Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter task name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endTime">End Time *</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Assign To *</Label>
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded p-2">
              {resources.map((resource) => (
                <label
                  key={resource.id}
                  className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedResourceIds.includes(resource.id)}
                    onChange={() => toggleResource(resource.id)}
                    className="rounded"
                  />
                  <span className="text-sm">{resource.name}</span>
                  {resource.teamName && (
                    <span className="text-xs text-muted-foreground">({resource.teamName})</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description (optional)"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : mode === "create" ? "Create" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
